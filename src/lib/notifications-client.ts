'use client'

import type {
  NotificationCategory,
  NotificationRow,
} from '@/src/lib/notifications'
import { isNotificationCategory } from '@/src/lib/notifications'

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  try {
    const res = await fetch('/api/notifications/count', { cache: 'no-store' })
    if (!res.ok) return 0
    const body = await parseJson<{ count?: number }>(res)
    return Math.max(0, Number(body?.count) || 0)
  } catch {
    return 0
  }
}

export async function fetchNotifications(params?: {
  limit?: number
  offset?: number
}): Promise<{ items: NotificationRow[]; error: string | null }> {
  try {
    const limit = params?.limit ?? 30
    const offset = params?.offset ?? 0
    const res = await fetch(
      `/api/notifications?limit=${limit}&offset=${offset}`,
      { cache: 'no-store' },
    )
    const body = await parseJson<{ items?: NotificationRow[]; error?: string }>(
      res,
    )
    if (!res.ok) {
      return { items: [], error: body?.error ?? 'Failed to load notifications' }
    }
    return { items: body?.items ?? [], error: null }
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : 'Failed to load notifications',
    }
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function markAllNotificationsRead(): Promise<boolean> {
  try {
    const res = await fetch('/api/notifications/read-all', { method: 'POST' })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchNotificationPreferences(): Promise<{
  prefs: Record<NotificationCategory, boolean>
  error: string | null
}> {
  const defaults = Object.fromEntries(
    (
      [
        'pool_invite',
        'friend',
        'badge',
        'level',
        'prediction_scored',
        'leaderboard',
        'announcement',
        'match_reminder',
      ] as const
    ).map((c) => [c, true]),
  ) as Record<NotificationCategory, boolean>

  try {
    const res = await fetch('/api/notifications/preferences', {
      cache: 'no-store',
    })
    const body = await parseJson<{
      prefs?: Record<string, boolean>
      error?: string
    }>(res)
    if (!res.ok) {
      return { prefs: defaults, error: body?.error ?? 'Failed to load' }
    }
    const merged = { ...defaults }
    for (const [key, value] of Object.entries(body?.prefs ?? {})) {
      if (isNotificationCategory(key)) merged[key] = Boolean(value)
    }
    return { prefs: merged, error: null }
  } catch (err) {
    return {
      prefs: defaults,
      error: err instanceof Error ? err.message : 'Failed to load',
    }
  }
}

export async function setNotificationPreference(
  category: NotificationCategory,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/notifications/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, enabled }),
    })
    const body = await parseJson<{ error?: string }>(res)
    if (!res.ok) return { ok: false, error: body?.error ?? 'Failed to save' }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}
