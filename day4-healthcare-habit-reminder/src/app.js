import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import { createHabitRemindersRouter } from './routes/habitReminders.js';

export function createApp() {
  const app = express();

  // Core middleware pipeline
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json({ limit: '16kb' }));

  // Health endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'healthcare-habit-reminder-api',
      requestId: req.id,
    });
  });

  // Domain routes
  app.use('/api/v1/habit-reminders', createHabitRemindersRouter());

  // 404 + Centralized Error Handler (must be registered last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
