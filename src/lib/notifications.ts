/** In-app notification categories (matches DB check constraint). */
export const NOTIFICATION_CATEGORIES = [
  'pool_invite',
  'friend',
  'badge',
  'level',
  'prediction_scored',
  'leaderboard',
  'announcement',
  'match_reminder',
] as const

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> =
  {
    pool_invite: 'Pool invites',
    friend: 'Friends',
    badge: 'Badges',
    level: 'Level ups',
    prediction_scored: 'Predictions scored',
    leaderboard: 'Leaderboard moves',
    announcement: 'Pool announcements',
    match_reminder: 'Match reminders',
  }

export type NotificationRow = {
  id: string
  category: string
  title: string
  body: string | null
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export function isNotificationCategory(
  value: string,
): value is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value)
}

export function notificationHref(
  data: Record<string, unknown> | null | undefined,
): string | null {
  const href = data?.href
  return typeof href === 'string' && href.startsWith('/') ? href : null
}

export function relativeNotificationTime(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const delta = Math.max(0, Date.now() - ms)
  const mins = Math.floor(delta / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ms).toLocaleDateString()
}
