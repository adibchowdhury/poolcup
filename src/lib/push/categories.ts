import type { NotificationCategory } from '@/src/lib/notifications'

/** Categories that also send browser push (in addition to in-app). */
export const PUSHABLE_NOTIFICATION_CATEGORIES = [
  'prediction_scored',
  'announcement',
  'match_reminder',
] as const satisfies readonly NotificationCategory[]

export type PushableNotificationCategory =
  (typeof PUSHABLE_NOTIFICATION_CATEGORIES)[number]

export function isPushableNotificationCategory(
  category: string,
): category is PushableNotificationCategory {
  return (PUSHABLE_NOTIFICATION_CATEGORIES as readonly string[]).includes(
    category,
  )
}
