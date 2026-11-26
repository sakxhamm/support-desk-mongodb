# Day 4 – Express Middleware & Validation: Healthcare Habit Reminder

An Express prototype for a **Healthcare Habit Reminder** service focused on **streaks**, **notification preferences**, and **patient privacy**, featuring reusable Zod input validation, correlation-ID & privacy-safe structured logging middleware, and centralized error handling.

## Project Structure

```text
day4-healthcare-habit-reminder/
├── package.json
├── README.md
├── scripts/
│   └── demo-requests.js               # Runs valid and invalid API request demonstrations
├── src/
│   ├── app.js                         # Express app & middleware pipeline
│   ├── server.js                      # HTTP server entrypoint
│   ├── errors/
│   │   └── AppError.js                # Operational error hierarchy
│   ├── middleware/
│   │   ├── errorHandler.js            # 404 + centralized error formatter
│   │   ├── requestId.js               # X-Request-Id correlation middleware
│   │   ├── requestLogger.js           # Privacy-safe structured JSON request logger
│   │   └── validate.js                # Reusable Zod validation middleware factory
│   ├── routes/
│   │   └── habitReminders.js          # Habit reminder, preferences, privacy & streak routes
│   └── schemas/
│       └── habitReminderSchemas.js    # Zod schemas & healthcare domain rules
└── tests/
    └── habitReminders.test.js         # Automated integration tests (node:test)
```

## Setup & Running

```bash
cd day4-healthcare-habit-reminder
npm install
```

### Start the API Server
```bash
npm start
# Listening on http://localhost:3000
```

### Run Automated Tests (10 cases: valid & invalid flows)
```bash
npm test
```

### Run Interactive Valid & Invalid Request Demo
```bash
npm run demo
```

## API Endpoints

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health check with `X-Request-Id` |
| `POST` | `/api/v1/habit-reminders` | Create a habit reminder with streak, notification, and privacy settings |
| `GET` | `/api/v1/habit-reminders/:id` | Retrieve a reminder (`?view=lockscreen` masks `habitName` when enabled) |
| `PATCH` | `/api/v1/habit-reminders/:id/preferences` | Update notification preferences and privacy controls |
| `POST` | `/api/v1/habit-reminders/:id/check-in` | Record a completion and update `currentCount` / `longestCount` streaks |

## Key Design Decisions

1. **Privacy-Safe Structured Logging (`requestLogger.js` + `requestId.js`)**:
   - Every request receives a UUID correlation ID (or echoes a safe client-supplied `X-Request-Id`) so support/engineering can trace errors via `requestId` without exposing sensitive data.
   - Logs emit only operational metadata (`timestamp`, `level`, `requestId`, `method`, `path`, `statusCode`, `durationMs`). Request bodies, `patientId`, and `habitName` are never logged to prevent PHI/PII leakage.

2. **Declarative Schema + Cross-Field Domain Validation (`validate.js` + `habitReminderSchemas.js`)**:
   - `validateRequest({ params, query, body })` validates and strips/normalizes inputs via Zod before route handlers run, returning structured `422 VALIDATION_ERROR` responses with per-field details.
   - Enforces healthcare-specific invariants:
     - **Explicit consent**: `privacy.consentGiven` must be `true` on creation.
     - **Medication SMS privacy**: `category === "medication"` over `channel === "sms"` requires `privacy.maskHabitNameInNotifications: true` so medication names are not exposed on unencrypted SMS or lockscreens.
     - **Streak integrity**: `streak.longestCount >= streak.currentCount` and `gracePeriodHours` bounded to `0–48`.
     - **Quiet hours**: `24h` `HH:MM` format and `quietHours.start !== quietHours.end`.

3. **Centralized Error Handling (`AppError.js` + `errorHandler.js`)**:
   - All operational errors (`BadRequestError` `400`, `PrivacyPolicyError` `403`, `NotFoundError` `404`, `ValidationError` `422`) and malformed JSON (`SyntaxError` from `express.json()`) flow into one `errorHandler` returning `{ error: { code, message, requestId, details? } }`.
   - Unexpected `500` errors omit internal stack traces from the HTTP response while logging safe error metadata internally.
