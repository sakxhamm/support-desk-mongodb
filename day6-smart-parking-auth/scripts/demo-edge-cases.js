import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';

async function runDemo() {
  const { app, config } = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(label, path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const body = await res.json();
    console.log(`\n=== ${label} (HTTP ${res.status}) ===`);
    console.log(JSON.stringify(body, null, 2));
    return body;
  }

  try {
    const d1 = await request('1. Driver 1 Login', '/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'driver1@campus.edu', password: 'DriverPass#1' }),
    });
    const d2 = await request('2. Driver 2 Login', '/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'driver2@campus.edu', password: 'DriverPass#2' }),
    });

    const token1 = d1.data.accessToken;
    const token2 = d2.data.accessToken;

    const expiredToken = jwt.sign(
      { sub: 'usr-driver-1', email: 'driver1@campus.edu', role: 'driver' },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: '-5s' }
    );
    await request('3. Expired Token Rejected', '/api/v1/slots', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    const resv1 = await request('4. Driver 1 Reserves A-101 (10:00-11:00)', '/api/v1/reservations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        slotId: 'A-101',
        vehiclePlate: 'DL01AB1234',
        startTime: '2026-11-28T10:00:00.000Z',
        endTime: '2026-11-28T11:00:00.000Z',
      }),
    });

    await request(
      '5. EDGE CASE: Driver 2 Overlapping Booking A-101 (10:30-11:30)',
      '/api/v1/reservations',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token2}` },
        body: JSON.stringify({
          slotId: 'A-101',
          vehiclePlate: 'DL02XY9876',
          startTime: '2026-11-28T10:30:00.000Z',
          endTime: '2026-11-28T11:30:00.000Z',
        }),
      }
    );

    await request(
      '6. Ownership Check: Driver 2 Tries to Cancel Driver 1 Reservation',
      `/api/v1/reservations/${resv1.data.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token2}` },
      }
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
