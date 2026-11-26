import { createApp } from '../src/app.js';

async function runDemo() {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function callApi(label, path, options = {}) {
    const { headers, ...restOptions } = options;
    const res = await fetch(`${baseUrl}${path}`, {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
    });
    const data = await res.json();
    console.log(`\n=== ${label} ===`);
    console.log(`Status: ${res.status} | X-Request-Id: ${res.headers.get('x-request-id')}`);
    console.log(JSON.stringify(data, null, 2));
    return data;
  }

  try {
    // 1. Valid creation
    const created = await callApi('1. VALID POST /api/v1/habit-reminders', '/api/v1/habit-reminders', {
      method: 'POST',
      headers: { 'X-Request-Id': 'demo-valid-create-01' },
      body: JSON.stringify({
        patientId: 'PAT-2048',
        habitName: 'Evening Blood Pressure Check',
        category: 'vitals',
        schedule: { frequency: 'daily', timeOfDay: '20:00', timezone: 'Asia/Kolkata' },
        streak: { currentCount: 3, longestCount: 7, gracePeriodHours: 6 },
        notificationPreferences: {
          channel: 'push',
          quietHours: { start: '22:30', end: '06:30' },
          maxDailyNudges: 2,
        },
        privacy: {
          maskHabitNameInNotifications: true,
          consentGiven: true,
          retentionDays: 180,
          shareStreakWithCareTeam: true,
        },
      }),
    });

    const reminderId = created.data.id;

    // 2. Valid lockscreen privacy view
    await callApi(
      '2. VALID GET /api/v1/habit-reminders/:id?view=lockscreen',
      `/api/v1/habit-reminders/${reminderId}?view=lockscreen`
    );

    // 3. Valid streak check-in
    await callApi(
      '3. VALID POST /api/v1/habit-reminders/:id/check-in',
      `/api/v1/habit-reminders/${reminderId}/check-in`,
      { method: 'POST', body: JSON.stringify({}) }
    );

    // 4. Invalid request: missing consent + invalid streak + bad quietHours
    await callApi('4. INVALID POST (Validation Errors)', '/api/v1/habit-reminders', {
      method: 'POST',
      headers: { 'X-Request-Id': 'demo-invalid-create-02' },
      body: JSON.stringify({
        patientId: 'INVALID_ID',
        habitName: 'A',
        category: 'medication',
        schedule: { frequency: 'hourly', timeOfDay: '99:00', timezone: 'UTC' },
        streak: { currentCount: 10, longestCount: 2, gracePeriodHours: 4 },
        notificationPreferences: {
          channel: 'sms',
          quietHours: { start: '22:00', end: '22:00' },
          maxDailyNudges: 9,
        },
        privacy: {
          maskHabitNameInNotifications: false,
          consentGiven: false,
          retentionDays: 2,
          shareStreakWithCareTeam: false,
        },
      }),
    });

    // 5. Invalid malformed JSON
    await callApi('5. INVALID POST (Malformed JSON)', '/api/v1/habit-reminders', {
      method: 'POST',
      body: '{"patientId": "PAT-2048",',
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
