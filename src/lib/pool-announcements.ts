import type { SupabaseClient } from '@supabase/supabase-js'

export const ANNOUNCEMENT_MAX_LENGTH = 500

export type PoolAnnouncement = {
  id: string
  message: string
  authorId: string
  createdAt: string
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function parseAnnouncementRow(raw: unknown): PoolAnnouncement | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = asString(row.id)
  const message = asString(row.message)
  const authorId = asString(row.author_id) ?? asString(row.authorId)
  const createdAt = asString(row.created_at) ?? asString(row.createdAt)
  if (!id || !message || !authorId || !createdAt) return null
  return { id, message, authorId, createdAt }
}

/** Latest active announcement the current user has not dismissed. */
export async function getActiveAnnouncement(
  supabase: SupabaseClient,
  poolId: string,
): Promise<PoolAnnouncement | null> {
  const { data, error } = await supabase.rpc('get_active_announcement', {
    p_pool_id: poolId,
  })
  if (error) {
    console.error('get_active_announcement failed:', error.message)
    return null
  }
  if (data == null) return null
  if (Array.isArray(data)) {
    return data.length > 0 ? parseAnnouncementRow(data[0]) : null
  }
  return parseAnnouncementRow(data)
}

/**
 * Latest is_active announcement for commissioner management
 * (ignores per-user dismissals).
 */
export async function getLatestActiveAnnouncement(
  supabase: SupabaseClient,
  poolId: string,
): Promise<PoolAnnouncement | null> {
  const { data, error } = await supabase
    .from('pool_announcements')
    .select('id, message, author_id, created_at')
    .eq('pool_id', poolId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('getLatestActiveAnnouncement failed:', error.message)
    return null
  }
  return parseAnnouncementRow(data)
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

  const { data, error } = await supabase
    .from('pool_announcements')
    .insert({
      pool_id: poolId,
      author_id: authorId,
      message: trimmed,
      is_active: true,
    })
    .select('id, message, author_id, created_at')
    .single()

  if (error || !data) {
    console.error('postPoolAnnouncement failed:', error?.message)
    return { ok: false, error: error?.message ?? 'Failed to post announcement' }
  }

  const announcement = parseAnnouncementRow(data)
  if (!announcement) {
    return { ok: false, error: 'Failed to post announcement' }
  }
  return { ok: true, announcement }
}

export async function clearPoolAnnouncement(
  supabase: SupabaseClient,
  announcementId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('pool_announcements')
    .update({ is_active: false })
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
