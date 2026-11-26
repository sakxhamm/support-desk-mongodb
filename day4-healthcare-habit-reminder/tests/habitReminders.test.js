import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  process.env.NODE_ENV = 'test';
  const app = createApp();
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

function buildValidMedicationPayload(overrides = {}) {
  return {
    patientId: 'PAT-1042',
    habitName: 'Take Metformin 500mg',
    category: 'medication',
    schedule: {
      frequency: 'daily',
      timeOfDay: '08:30',
      timezone: 'Asia/Kolkata',
    },
    streak: {
      currentCount: 5,
      longestCount: 12,
      gracePeriodHours: 4,
    },
    notificationPreferences: {
      channel: 'push',
      quietHours: { start: '22:00', end: '07:00' },
      maxDailyNudges: 2,
    },
    privacy: {
      maskHabitNameInNotifications: true,
      consentGiven: true,
      retentionDays: 90,
      shareStreakWithCareTeam: true,
    },
    ...overrides,
  };
}

describe('Healthcare Habit Reminder API - Middleware & Validation', () => {
  let createdReminderId;

  it('assigns X-Request-Id header automatically and echoes valid client X-Request-Id', async () => {
    const autoRes = await fetch(`${baseUrl}/health`);
    assert.equal(autoRes.status, 200);
    assert.ok(autoRes.headers.get('x-request-id'));

    const customId = 'req-health-check-001';
    const customRes = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Request-Id': customId },
    });
    assert.equal(customRes.status, 200);
    assert.equal(customRes.headers.get('x-request-id'), customId);
  });

  it('VALID: creates a medication habit reminder with privacy masking enabled', async () => {
    const res = await fetch(`${baseUrl}/api/v1/habit-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildValidMedicationPayload()),
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.ok(body.requestId);
    assert.match(body.data.id, /^REM-/);
    assert.equal(body.data.habitName, 'Take Metformin 500mg');
    assert.equal(body.data.notificationPreview, 'Reminder (push): Daily health check-in');

    createdReminderId = body.data.id;
  });

  it('VALID: masks habitName when retrieved with ?view=lockscreen', async () => {
    const res = await fetch(`${baseUrl}/api/v1/habit-reminders/${createdReminderId}?view=lockscreen`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.data.habitName, 'Daily health check-in');
  });

  it('VALID: records a check-in and increments streak counts', async () => {
    const res = await fetch(`${baseUrl}/api/v1/habit-reminders/${createdReminderId}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: '2026-11-26T08:35:00.000Z' }),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.data.streak.currentCount, 6);
    assert.equal(body.data.streak.longestCount, 12);
    assert.equal(body.data.streak.lastCompletedAt, '2026-11-26T08:35:00.000Z');
  });

  it('INVALID (422): rejects missing privacy consent', async () => {
    const payload = buildValidMedicationPayload({
      privacy: {
        maskHabitNameInNotifications: true,
        consentGiven: false,
        retentionDays: 90,
        shareStreakWithCareTeam: false,
      },
    });

    const res = await fetch(`${baseUrl}/api/v1/habit-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    assert.equal(res.status, 422);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.some((d) => d.field === 'privacy.consentGiven'));
  });

  it('INVALID (422): rejects medication reminder over SMS without habit name masking', async () => {
    const payload = buildValidMedicationPayload({
      notificationPreferences: {
        channel: 'sms',
        quietHours: { start: '22:00', end: '07:00' },
        maxDailyNudges: 2,
      },
      privacy: {
        maskHabitNameInNotifications: false,
        consentGiven: true,
        retentionDays: 90,
        shareStreakWithCareTeam: false,
      },
    });

    const res = await fetch(`${baseUrl}/api/v1/habit-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    assert.equal(res.status, 422);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(
      body.error.details.some((d) => d.field === 'privacy.maskHabitNameInNotifications')
    );
  });

  it('INVALID (422): rejects streak where longestCount < currentCount and invalid timeOfDay', async () => {
    const payload = buildValidMedicationPayload({
      schedule: { frequency: 'daily', timeOfDay: '25:99', timezone: 'UTC' },
      streak: { currentCount: 10, longestCount: 4, gracePeriodHours: 2 },
    });

    const res = await fetch(`${baseUrl}/api/v1/habit-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    assert.equal(res.status, 422);
    assert.ok(body.error.details.some((d) => d.field === 'schedule.timeOfDay'));
    assert.ok(body.error.details.some((d) => d.field === 'streak.longestCount'));
  });

  it('INVALID (403): blocks switching existing medication reminder to unmasked SMS via PATCH', async () => {
    const res = await fetch(`${baseUrl}/api/v1/habit-reminders/${createdReminderId}/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationPreferences: { channel: 'sms' },
        privacy: { maskHabitNameInNotifications: false },
      }),
    });
    const body = await res.json();

    assert.equal(res.status, 403);
    assert.equal(body.error.code, 'PRIVACY_POLICY_VIOLATION');
  });

  it('INVALID (400): handles malformed JSON via centralized error handler', async () => {
    const res = await fetch(`${baseUrl}/api/v1/habit-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"patientId": "PAT-1042", broken',
    });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error.code, 'BAD_REQUEST');
    assert.ok(body.error.requestId);
  });

  it('INVALID (404): returns structured NotFoundError for unknown route', async () => {
    const res = await fetch(`${baseUrl}/api/v1/unknown-endpoint`);
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.ok(body.error.requestId);
  });
});
