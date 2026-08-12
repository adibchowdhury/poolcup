import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationCategory } from '@/src/lib/notifications'
import { tryCreateNotification } from '@/src/lib/notify-user'
import { isPushableNotificationCategory } from '@/src/lib/push/categories'
import { sendPushToUser } from '@/src/lib/push/send-push'

/**
 * create_notification + browser push for pushable categories.
 * Server-only (web-push). Preference gating is inside create_notification
 * (null id ⇒ skip push).
 */
export async function tryCreateNotificationWithPush(
  admin: SupabaseClient,
  params: {
    userId: string
    category: NotificationCategory
    title: string
    body?: string | null
    data?: Record<string, unknown> | null
  },
  context: string,
): Promise<string | null> {
  const id = await tryCreateNotification(admin, params, context)
  if (!id) return null

  if (isPushableNotificationCategory(params.category)) {
    await sendPushToUser(
      admin,
      params.userId,
      {
        title: params.title,
        body: params.body,
        data: params.data,
        category: params.category,
      },
      `${context}:push`,
    )
  }

  return id
}
