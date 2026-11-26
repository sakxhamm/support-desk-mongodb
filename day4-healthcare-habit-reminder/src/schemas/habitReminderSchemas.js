import { z } from 'zod';

const TIME_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const PATIENT_ID_REGEX = /^PAT-[A-Z0-9]{4,12}$/;
const REMINDER_ID_REGEX = /^REM-[a-zA-Z0-9-]{6,36}$/;

export const HABIT_CATEGORIES = [
  'medication',
  'hydration',
  'exercise',
  'vitals',
  'sleep',
  'mental_health',
];

export const NOTIFICATION_CHANNELS = ['push', 'sms', 'email', 'in_app'];

const quietHoursSchema = z
  .object({
    start: z.string().regex(TIME_24H_REGEX, 'quietHours.start must be HH:MM (24-hour)'),
    end: z.string().regex(TIME_24H_REGEX, 'quietHours.end must be HH:MM (24-hour)'),
  })
  .strict()
  .refine((qh) => qh.start !== qh.end, {
    message: 'quietHours.start and quietHours.end cannot be identical',
    path: ['end'],
  });

const notificationPreferencesSchema = z
  .object({
    channel: z.enum(NOTIFICATION_CHANNELS),
    quietHours: quietHoursSchema,
    maxDailyNudges: z.number().int().min(1).max(5),
  })
  .strict();

const privacySchema = z
  .object({
    maskHabitNameInNotifications: z.boolean(),
    consentGiven: z.literal(true, {
      errorMap: () => ({
        message: 'Explicit patient privacy consent (consentGiven: true) is required',
      }),
    }),
    retentionDays: z.number().int().min(7).max(365),
    shareStreakWithCareTeam: z.boolean(),
  })
  .strict();

const streakSchema = z
  .object({
    currentCount: z.number().int().min(0).max(10000).default(0),
    longestCount: z.number().int().min(0).max(10000).default(0),
    gracePeriodHours: z.number().int().min(0).max(48).default(4),
  })
  .strict()
  .refine((s) => s.longestCount >= s.currentCount, {
    message: 'streak.longestCount must be greater than or equal to streak.currentCount',
    path: ['longestCount'],
  });

export const createHabitReminderBodySchema = z
  .object({
    patientId: z
      .string()
      .regex(PATIENT_ID_REGEX, 'patientId must match PAT-XXXX (4-12 alphanumeric chars)'),
    habitName: z.string().trim().min(2).max(80),
    category: z.enum(HABIT_CATEGORIES),
    schedule: z
      .object({
        frequency: z.enum(['daily', 'weekly', 'custom']),
        timeOfDay: z.string().regex(TIME_24H_REGEX, 'timeOfDay must be HH:MM (24-hour)'),
        timezone: z.string().trim().min(2).max(50),
      })
      .strict(),
    streak: streakSchema.default({ currentCount: 0, longestCount: 0, gracePeriodHours: 4 }),
    notificationPreferences: notificationPreferencesSchema,
    privacy: privacySchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.category === 'medication' &&
      data.notificationPreferences.channel === 'sms' &&
      !data.privacy.maskHabitNameInNotifications
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['privacy', 'maskHabitNameInNotifications'],
        message:
          'Medication reminders sent via SMS must enable maskHabitNameInNotifications for PHI privacy',
      });
    }
  });

export const reminderIdParamsSchema = z.object({
  id: z.string().regex(REMINDER_ID_REGEX, 'Invalid reminder ID format (expected REM-...)'),
});

export const getReminderQuerySchema = z.object({
  view: z.enum(['full', 'lockscreen']).optional().default('full'),
});

export const updatePreferencesBodySchema = z
  .object({
    notificationPreferences: notificationPreferencesSchema.partial().optional(),
    privacy: z
      .object({
        maskHabitNameInNotifications: z.boolean().optional(),
        retentionDays: z.number().int().min(7).max(365).optional(),
        shareStreakWithCareTeam: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((data) => data.notificationPreferences || data.privacy, {
    message: 'At least one of notificationPreferences or privacy must be provided',
  });

export const checkInBodySchema = z
  .object({
    completedAt: z.string().datetime({ message: 'completedAt must be a valid ISO-8601 timestamp' }).optional(),
  })
  .strict();
