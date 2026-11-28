import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';

let server;
let baseUrl;
let appConfig;
let appStore;

before(async () => {
  const { app, config, store } = createApp();
  appConfig = config;
  appStore = store;

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function login(email, password) {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, body: await res.json() };
}

describe('Smart Parking Service - Auth, Roles, Ownership & Reservation Conflicts', () => {
  let driver1Token;
  let driver2Token;
  let operatorToken;
  let driver1ReservationId;

  it('stores bcrypt password hashes (never plaintext) and issues signed JWT on login', async () => {
    const storedUser = appStore.users.get('driver1@campus.edu');
    assert.ok(storedUser.passwordHash.startsWith('$2'));
    assert.notEqual(storedUser.passwordHash, 'DriverPass#1');

    const badLogin = await login('driver1@campus.edu', 'WrongPass!');
    assert.equal(badLogin.status, 401);
    assert.equal(badLogin.body.error.code, 'INVALID_CREDENTIALS');

    const d1 = await login('driver1@campus.edu', 'DriverPass#1');
    const d2 = await login('driver2@campus.edu', 'DriverPass#2');
    const op = await login('operator@smartpark.io', 'OperatorPass#1');

    assert.equal(d1.status, 200);
    assert.equal(d1.body.data.tokenType, 'Bearer');
    assert.equal(d1.body.data.expiresIn, '15m');

    driver1Token = d1.body.data.accessToken;
    driver2Token = d2.body.data.accessToken;
    operatorToken = op.body.data.accessToken;
  });

  it('rejects unauthenticated and expired JWT tokens on protected routes', async () => {
    const noAuth = await fetch(`${baseUrl}/api/v1/slots`);
    assert.equal(noAuth.status, 401);

    const expiredToken = jwt.sign(
      { sub: 'usr-driver-1', email: 'driver1@campus.edu', role: 'driver' },
      appConfig.jwtSecret,
      { algorithm: 'HS256', expiresIn: '-10s' }
    );

    const expiredRes = await fetch(`${baseUrl}/api/v1/slots`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const expiredBody = await expiredRes.json();

    assert.equal(expiredRes.status, 401);
    assert.equal(expiredBody.error.code, 'TOKEN_EXPIRED');
  });

  it('EDGE CASE: prevents overlapping slot reservations (409) while allowing adjacent boundary', async () => {
    // Driver 1 books A-101 for 10:00 - 11:00
    const first = await fetch(`${baseUrl}/api/v1/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driver1Token}`,
      },
      body: JSON.stringify({
        slotId: 'A-101',
        vehiclePlate: 'DL01AB1234',
        startTime: '2026-11-28T10:00:00.000Z',
        endTime: '2026-11-28T11:00:00.000Z',
      }),
    });
    const firstBody = await first.json();
    assert.equal(first.status, 201);
    driver1ReservationId = firstBody.data.id;

    // Driver 2 attempts overlapping 10:30 - 11:30 on A-101 -> 409 Conflict
    const overlap = await fetch(`${baseUrl}/api/v1/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driver2Token}`,
      },
      body: JSON.stringify({
        slotId: 'A-101',
        vehiclePlate: 'DL02XY9876',
        startTime: '2026-11-28T10:30:00.000Z',
        endTime: '2026-11-28T11:30:00.000Z',
      }),
    });
    const overlapBody = await overlap.json();
    assert.equal(overlap.status, 409);
    assert.equal(overlapBody.error.code, 'SLOT_RESERVATION_CONFLICT');

    // Driver 2 books adjacent 11:00 - 12:00 on A-101 -> 201 Created
    const adjacent = await fetch(`${baseUrl}/api/v1/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driver2Token}`,
      },
      body: JSON.stringify({
        slotId: 'A-101',
        vehiclePlate: 'DL02XY9876',
        startTime: '2026-11-28T11:00:00.000Z',
        endTime: '2026-11-28T12:00:00.000Z',
      }),
    });
    assert.equal(adjacent.status, 201);
  });

  it('enforces ownership check when canceling another driver reservation (403)', async () => {
    const forbiddenCancel = await fetch(
      `${baseUrl}/api/v1/reservations/${driver1ReservationId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${driver2Token}` },
      }
    );
    const forbiddenBody = await forbiddenCancel.json();
    assert.equal(forbiddenCancel.status, 403);
    assert.equal(forbiddenBody.error.code, 'FORBIDDEN');

    const ownerCancel = await fetch(
      `${baseUrl}/api/v1/reservations/${driver1ReservationId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${driver1Token}` },
      }
    );
    assert.equal(ownerCancel.status, 200);
  });

  it('enforces operator role for slot maintenance toggle and blocks bookings in maintenance', async () => {
    const driverAttempt = await fetch(`${baseUrl}/api/v1/slots/EV-201/maintenance`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driver1Token}`,
      },
      body: JSON.stringify({ inMaintenance: true }),
    });
    assert.equal(driverAttempt.status, 403);

    const operatorAttempt = await fetch(`${baseUrl}/api/v1/slots/EV-201/maintenance`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
      },
      body: JSON.stringify({ inMaintenance: true }),
    });
    assert.equal(operatorAttempt.status, 200);

    const bookMaintenanceSlot = await fetch(`${baseUrl}/api/v1/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driver1Token}`,
      },
      body: JSON.stringify({
        slotId: 'EV-201',
        vehiclePlate: 'DL01EV0001',
        startTime: '2026-11-28T14:00:00.000Z',
        endTime: '2026-11-28T15:00:00.000Z',
      }),
    });
    const maintBody = await bookMaintenanceSlot.json();
    assert.equal(bookMaintenanceSlot.status, 409);
    assert.equal(maintBody.error.code, 'SLOT_IN_MAINTENANCE');
  });
});
