import 'server-only'

import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isPushableNotificationCategory } from '@/src/lib/push/categories'
import {
  getVapidPrivateKey,
  getVapidPublicKey,
  getVapidSubject,
} from '@/src/lib/push/vapid'

let vapidConfigured = false

function ensureWebPushConfigured(): boolean {
  if (vapidConfigured) return true
  const publicKey = getVapidPublicKey()
  const privateKey = getVapidPrivateKey()
  if (!publicKey || !privateKey) {
    console.error('sendPush: VAPID keys are not configured')
    return false
  }
  webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey)
  vapidConfigured = true
  return true
}

type PushSubscriptionRow = {
  endpoint: string
  p256dh: string
  auth: string
}

function asSubscriptionRows(data: unknown): PushSubscriptionRow[] {
  if (!Array.isArray(data)) return []
  const rows: PushSubscriptionRow[] = []
  for (const row of data) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const endpoint = typeof r.endpoint === 'string' ? r.endpoint : ''
    const p256dh = typeof r.p256dh === 'string' ? r.p256dh : ''
    const auth = typeof r.auth === 'string' ? r.auth : ''
    if (endpoint && p256dh && auth) {
      rows.push({ endpoint, p256dh, auth })
    }
  }
  return rows
}

async function deleteExpired(
  admin: SupabaseClient,
  endpoint: string,
  context: string,
): Promise<void> {
  const { error } = await admin.rpc('delete_push_subscription', {
    p_endpoint: endpoint,
  })
  if (error) {
    console.error(`${context}: delete_push_subscription failed`, {
      endpoint,
      message: error.message,
    })
  }
}

async function bumpFailureCount(
  admin: SupabaseClient,
  endpoint: string,
): Promise<void> {
  try {
    const { data } = await admin
      .from('push_subscriptions')
      .select('failure_count')
      .eq('endpoint', endpoint)
      .maybeSingle()
    const next = Math.max(0, Number(data?.failure_count) || 0) + 1
    await admin
      .from('push_subscriptions')
      .update({
        failure_count: next,
        last_used_at: new Date().toISOString(),
      })
      .eq('endpoint', endpoint)
  } catch {
    /* best-effort */
  }
}

/**
 * Send a browser push to all of a user's subscriptions.
 * Call only for pushable categories (or test). Never throws.
 */
export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: {
    title: string
    body?: string | null
    data?: Record<string, unknown> | null
    category?: string | null
  },
  context: string,
): Promise<{ sent: number; removed: number }> {
  if (!userId) return { sent: 0, removed: 0 }
  if (!ensureWebPushConfigured()) return { sent: 0, removed: 0 }

  const category = payload.category ?? null
  if (category && !isPushableNotificationCategory(category) && category !== 'test') {
    return { sent: 0, removed: 0 }
  }

  try {
    const { data, error } = await admin.rpc('get_user_push_subscriptions', {
      p_user_id: userId,
    })
    if (error) {
      console.error(`${context}: get_user_push_subscriptions failed`, {
        userId,
        message: error.message,
      })
      return { sent: 0, removed: 0 }
    }

    const rows = asSubscriptionRows(data)
    if (rows.length === 0) return { sent: 0, removed: 0 }

    const href =
      payload.data &&
      typeof payload.data.href === 'string' &&
      payload.data.href.startsWith('/')
        ? payload.data.href
        : '/dashboard'

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body ?? '',
      data: {
        ...(payload.data ?? {}),
        href,
        category: category ?? undefined,
      },
    })

    let sent = 0
    let removed = 0

    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            body,
            { TTL: 60 * 60 * 12 },
          )
          sent += 1
          await admin
            .from('push_subscriptions')
            .update({
              last_used_at: new Date().toISOString(),
              failure_count: 0,
            })
            .eq('endpoint', row.endpoint)
        } catch (err) {
          const statusCode =
            err && typeof err === 'object' && 'statusCode' in err
              ? Number((err as { statusCode: unknown }).statusCode)
              : null
          if (statusCode === 404 || statusCode === 410) {
            await deleteExpired(admin, row.endpoint, context)
            removed += 1
            return
          }
          console.error(`${context}: webpush send failed`, {
            endpoint: row.endpoint,
            statusCode,
            message: err instanceof Error ? err.message : String(err),
          })
          await bumpFailureCount(admin, row.endpoint)
        }
      }),
    )

    return { sent, removed }
  } catch (err) {
    console.error(`${context}: sendPushToUser threw`, err)
    return { sent: 0, removed: 0 }
  }
}
