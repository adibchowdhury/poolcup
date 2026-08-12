import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationCategory } from '@/src/lib/notifications'

/**
 * Best-effort create_notification (service_role). Respects user preferences
 * inside the RPC (returns null when category disabled). Never throws.
 */
export async function tryCreateNotification(
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
  try {
    const { data, error } = await admin.rpc('create_notification', {
      p_user_id: params.userId,
      p_category: params.category,
      p_title: params.title,
      p_body: params.body ?? null,
      p_data: params.data ?? {},
    })
    if (error) {
      console.error(`${context}: create_notification failed`, {
        userId: params.userId,
        category: params.category,
        message: error.message,
      })
      return null
    }
    return data == null ? null : String(data)
  } catch (err) {
    console.error(`${context}: create_notification threw`, err)
    return null
  }
}

export async function tryNotifyLevelUp(
  admin: SupabaseClient,
  userId: string,
  newLevel: number,
  context: string,
): Promise<void> {
  if (!userId || newLevel < 2) return
  await tryCreateNotification(
    admin,
    {
      userId,
      category: 'level',
      title: `You reached level ${newLevel}!`,
      body: 'Keep predicting to climb higher.',
      data: { href: '/dashboard?tab=profile', level: newLevel },
    },
    context,
  )
}
