import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { NotFoundError, PrivacyPolicyError } from '../errors/AppError.js';
import { validateRequest } from '../middleware/validate.js';
import {
  checkInBodySchema,
  createHabitReminderBodySchema,
  getReminderQuerySchema,
  reminderIdParamsSchema,
  updatePreferencesBodySchema,
} from '../schemas/habitReminderSchemas.js';

const LOCKSCREEN_PLACEHOLDER = 'Daily health check-in';

/**
 * Formats a reminder for response, masking sensitive habit names when
 * requested in lockscreen view and privacy masking is enabled.
 */
function formatReminderResponse(reminder, view = 'full') {
  const shouldMask =
    view === 'lockscreen' && reminder.privacy.maskHabitNameInNotifications;

  return {
    ...reminder,
    habitName: shouldMask ? LOCKSCREEN_PLACEHOLDER : reminder.habitName,
    notificationPreview: reminder.privacy.maskHabitNameInNotifications
      ? `Reminder (${reminder.notificationPreferences.channel}): ${LOCKSCREEN_PLACEHOLDER}`
      : `Reminder (${reminder.notificationPreferences.channel}): ${reminder.habitName}`,
  };
}

export function createHabitRemindersRouter(store = new Map()) {
  const router = Router();

  // POST /api/v1/habit-reminders
  router.post(
    '/',
    validateRequest({ body: createHabitReminderBodySchema }),
    (req, res) => {
      const now = new Date().toISOString();
      const id = `REM-${randomUUID().slice(0, 8)}`;

      const reminder = {
        id,
        ...req.body,
        streak: {
          ...req.body.streak,
          lastCompletedAt: null,
        },
        createdAt: now,
        updatedAt: now,
      };

      store.set(id, reminder);

      res.status(201).json({
        requestId: req.id,
        data: formatReminderResponse(reminder),
      });
    }
  );

  // GET /api/v1/habit-reminders/:id
  router.get(
    '/:id',
    validateRequest({ params: reminderIdParamsSchema, query: getReminderQuerySchema }),
    (req, res, next) => {
      const reminder = store.get(req.params.id);
      if (!reminder) {
        return next(new NotFoundError(`Habit reminder ${req.params.id}`));
      }

      return res.status(200).json({
        requestId: req.id,
        data: formatReminderResponse(reminder, req.query.view),
      });
    }
  );

  // PATCH /api/v1/habit-reminders/:id/preferences
  router.patch(
    '/:id/preferences',
    validateRequest({ params: reminderIdParamsSchema, body: updatePreferencesBodySchema }),
    (req, res, next) => {
      const reminder = store.get(req.params.id);
      if (!reminder) {
        return next(new NotFoundError(`Habit reminder ${req.params.id}`));
      }

      const nextNotificationPreferences = {
        ...reminder.notificationPreferences,
        ...(req.body.notificationPreferences ?? {}),
      };

      const nextPrivacy = {
        ...reminder.privacy,
        ...(req.body.privacy ?? {}),
      };

      // Domain privacy guard across existing + updated state
      if (
        reminder.category === 'medication' &&
        nextNotificationPreferences.channel === 'sms' &&
        !nextPrivacy.maskHabitNameInNotifications
      ) {
        return next(
          new PrivacyPolicyError(
            'Medication reminders sent via SMS must keep maskHabitNameInNotifications enabled',
            {
              category: reminder.category,
              channel: nextNotificationPreferences.channel,
              maskHabitNameInNotifications: nextPrivacy.maskHabitNameInNotifications,
            }
          )
        );
      }

      reminder.notificationPreferences = nextNotificationPreferences;
      reminder.privacy = nextPrivacy;
      reminder.updatedAt = new Date().toISOString();

      return res.status(200).json({
        requestId: req.id,
        data: formatReminderResponse(reminder),
      });
    }
  );

  // POST /api/v1/habit-reminders/:id/check-in
  router.post(
    '/:id/check-in',
    validateRequest({ params: reminderIdParamsSchema, body: checkInBodySchema }),
    (req, res, next) => {
      const reminder = store.get(req.params.id);
      if (!reminder) {
        return next(new NotFoundError(`Habit reminder ${req.params.id}`));
      }

      const completedAt = req.body.completedAt ?? new Date().toISOString();
      const nextCount = reminder.streak.currentCount + 1;
      const nextLongest = Math.max(reminder.streak.longestCount, nextCount);

      reminder.streak = {
        ...reminder.streak,
        currentCount: nextCount,
        longestCount: nextLongest,
        lastCompletedAt: completedAt,
      };
      reminder.updatedAt = new Date().toISOString();

      return res.status(200).json({
        requestId: req.id,
        data: formatReminderResponse(reminder),
      });
    }
  );

  return router;
}
