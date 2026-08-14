import type { SupabaseClient } from '@supabase/supabase-js'

export const ANNOUNCEMENT_MAX_LENGTH = 500

export type PoolAnnouncement = {
  id: string
  message: string
  authorId: string
  authorName?: string | null
  createdAt: string
  updatedAt?: string | null
  pinned?: boolean
  isActive?: boolean
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function parseAnnouncementRow(raw: unknown): PoolAnnouncement | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = asString(row.id)
  const message = asString(row.message)
  const authorId = asString(row.author_id) ?? asString(row.authorId)
  const createdAt = asString(row.created_at) ?? asString(row.createdAt)
  if (!id || !message || !authorId || !createdAt) return null
  const updatedAt =
    asString(row.updated_at) ?? asString(row.updatedAt) ?? null
  const authorName =
    asString(row.author_name) ??
    asString(row.authorName) ??
    asString(row.display_name) ??
    null
  return {
    id,
    message,
    authorId,
    authorName,
    createdAt,
    updatedAt,
    pinned: Boolean(row.pinned),
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
  }
}

export function announcementWasEdited(announcement: PoolAnnouncement): boolean {
  if (!announcement.updatedAt) return false
  const created = Date.parse(announcement.createdAt)
  const updated = Date.parse(announcement.updatedAt)
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return false
  return updated > created + 1000
}

export function sortAnnouncements(
  rows: PoolAnnouncement[],
): PoolAnnouncement[] {
  return [...rows].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
  })
}

/** @deprecated Prefer list/banner helpers; kept for transitional call sites. */
export async function getActiveAnnouncement(
  supabase: SupabaseClient,
  poolId: string,
): Promise<PoolAnnouncement | null> {
  const result = await fetchPoolAnnouncementsApi(poolId)
  return result.banner
}

/** Latest is_active announcement for commissioner management (legacy). */
export async function getLatestActiveAnnouncement(
  supabase: SupabaseClient,
  poolId: string,
): Promise<PoolAnnouncement | null> {
  const { data, error } = await supabase
    .from('pool_announcements')
    .select('id, message, author_id, created_at, updated_at, pinned, is_active')
    .eq('pool_id', poolId)
    .eq('is_active', true)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('getLatestActiveAnnouncement failed:', error.message)
    return null
  }
  return parseAnnouncementRow(data)
}

export async function fetchPoolAnnouncementsApi(poolId: string): Promise<{
  rows: PoolAnnouncement[]
  banner: PoolAnnouncement | null
  error?: string
}> {
  try {
    const res = await fetch(
      `/api/pools/${encodeURIComponent(poolId)}/announcements`,
    )
    const data = (await res.json()) as {
      rows?: PoolAnnouncement[]
      banner?: PoolAnnouncement | null
      error?: string
    }
    if (!res.ok) {
      return {
        rows: [],
        banner: null,
        error: data.error || 'Could not load announcements',
      }
    }
    return {
      rows: Array.isArray(data.rows) ? data.rows : [],
      banner: data.banner ?? null,
    }
  } catch {
    return { rows: [], banner: null, error: 'Could not load announcements' }
  }
}

export async function postPoolAnnouncement(
  supabase: SupabaseClient,
  poolId: string,
  authorId: string,
  message: string,
): Promise<
  { ok: true; announcement: PoolAnnouncement } | { ok: false; error: string }
> {
  const trimmed = message.trim()
  if (!trimmed) {
    return { ok: false, error: 'Write a message first' }
  }
  if (trimmed.length > ANNOUNCEMENT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Keep it under ${ANNOUNCEMENT_MAX_LENGTH} characters`,
    }
  }

  try {
    const res = await fetch(
      `/api/pools/${encodeURIComponent(poolId)}/announcements`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      },
    )
    const data = (await res.json()) as {
      announcement?: PoolAnnouncement | Record<string, unknown>
      error?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'Failed to post announcement',
      }
    }
    const announcement =
      data.announcement && 'id' in data.announcement && 'message' in data.announcement
        ? (data.announcement as PoolAnnouncement)
        : parseAnnouncementRow(data.announcement)
    if (!announcement) {
      return { ok: false, error: 'Failed to post announcement' }
    }
    return { ok: true, announcement }
  } catch (err) {
    console.error('postPoolAnnouncement failed:', err)
    return { ok: false, error: 'Failed to post announcement' }
  }
}

export async function updatePoolAnnouncementMessage(
  supabase: SupabaseClient,
  announcementId: string,
  message: string,
): Promise<
  { ok: true; announcement: PoolAnnouncement } | { ok: false; error: string }
> {
  const trimmed = message.trim()
  if (!trimmed) {
    return { ok: false, error: 'Write a message first' }
  }
  if (trimmed.length > ANNOUNCEMENT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Keep it under ${ANNOUNCEMENT_MAX_LENGTH} characters`,
    }
  }

  const { data, error } = await supabase
    .from('pool_announcements')
    .update({ message: trimmed })
    .eq('id', announcementId)
    .eq('is_active', true)
    .select('id, message, author_id, created_at, updated_at, pinned, is_active')
    .maybeSingle()

  if (error || !data) {
    console.error('updatePoolAnnouncementMessage failed:', error?.message)
    return { ok: false, error: error?.message ?? 'Failed to update announcement' }
  }
  const announcement = parseAnnouncementRow(data)
  if (!announcement) {
    return { ok: false, error: 'Failed to update announcement' }
  }
  return { ok: true, announcement }
}

/** Soft-delete via API (admin-gated + moderation log). */
export async function softDeletePoolAnnouncementApi(
  poolId: string,
  announcementId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(
    `/api/pools/${encodeURIComponent(poolId)}/announcements/${encodeURIComponent(announcementId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    },
  )
  const data = (await res.json().catch(() => null)) as {
    error?: string
  } | null
  if (!res.ok) {
    return { ok: false, error: data?.error || 'Failed to delete announcement' }
  }
  return { ok: true }
}

export async function setAnnouncementPinnedApi(
  poolId: string,
  announcementId: string,
  pinned: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(
    `/api/pools/${encodeURIComponent(poolId)}/announcements/${encodeURIComponent(announcementId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    },
  )
  const data = (await res.json().catch(() => null)) as {
    error?: string
  } | null
  if (!res.ok) {
    return { ok: false, error: data?.error || 'Failed to update pin' }
  }
  return { ok: true }
}

export async function clearPoolAnnouncement(
  supabase: SupabaseClient,
  announcementId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('pool_announcements')
    .update({ is_active: false, pinned: false })
    .eq('id', announcementId)

  if (error) {
    console.error('clearPoolAnnouncement failed:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function dismissPoolAnnouncement(
  supabase: SupabaseClient,
  announcementId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('dismiss_announcement', {
    p_announcement_id: announcementId,
  })
  if (error) {
    console.error('dismiss_announcement failed:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
