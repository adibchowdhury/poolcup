import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchDmUnreadCount } from '@/src/lib/dm-chats'

export const POOL_MARKED_READ_EVENT = 'pool-marked-read'

type PoolUnreadCountRow = {
  pool_id: string
  unread_count: number
}

export type UnreadChatRow = {
  pool_id: string
  pool_name: string
  unread_count: number
  last_message_at: string
  invite_code: string
}

type UnreadChatRpcRow = {
  pool_id: string
  pool_name: string
  unread_count: number
  last_message_at: string
}

export function getPoolChatHref(inviteCode: string): string {
  return `/pool/${inviteCode}?tab=chat`
}

export function getPoolLeaderboardHref(inviteCode: string): string {
  return `/pool/${inviteCode}?tab=leaderboard`
}

export async function fetchPoolUnreadChatCount(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_chat_count')

  if (error) {
    console.error('Failed to fetch unread chat count:', error.message)
    return 0
  }

  if (typeof data === 'number' && Number.isFinite(data)) {
    return Math.max(0, Math.floor(data))
  }

  return 0
}

/** Total unread across pool chats + DMs (for the chat nav badge). */
export async function fetchUnreadChatCount(
  supabase: SupabaseClient,
): Promise<number> {
  const [poolUnread, dmUnread] = await Promise.all([
    fetchPoolUnreadChatCount(supabase),
    fetchDmUnreadCount(supabase),
  ])
  return poolUnread + dmUnread
}

export async function fetchPoolUnreadCounts(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('get_my_pool_unread_counts')

  if (error) {
    console.error('Failed to fetch pool unread counts:', error.message)
    return new Map()
  }

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as PoolUnreadCountRow[]) {
    counts.set(row.pool_id, row.unread_count)
  }
  return counts
}

export async function fetchMyUnreadChats(
  supabase: SupabaseClient,
): Promise<UnreadChatRow[]> {
  const { data, error } = await supabase.rpc('get_my_unread_chats')

  if (error) {
    console.error('Failed to fetch unread chats:', error.message)
    return []
  }

  const rows = (data ?? []) as UnreadChatRpcRow[]
  if (rows.length === 0) return []

  const poolIds = rows.map((row) => row.pool_id)
  const { data: pools, error: poolsError } = await supabase
    .from('pools')
    .select('id, invite_code')
    .in('id', poolIds)

  if (poolsError) {
    console.error('Failed to load pool invite codes:', poolsError.message)
    return []
  }

  const inviteByPoolId = new Map(
    (pools ?? []).map((pool) => [pool.id, pool.invite_code as string]),
  )

  return rows
    .map((row) => ({
      ...row,
      invite_code: inviteByPoolId.get(row.pool_id) ?? '',
    }))
    .filter((row) => row.invite_code !== '')
}

/** Current user's last_read_at for a pool, or null if never read. */
export async function fetchPoolLastReadAt(
  supabase: SupabaseClient,
  poolId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('pool_chat_reads')
    .select('last_read_at')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch pool last_read_at:', error.message)
    return null
  }

  const value = (data as { last_read_at?: string } | null)?.last_read_at
  return typeof value === 'string' && value ? value : null
}

export async function markPoolRead(
  supabase: SupabaseClient,
  poolId: string,
  userId?: string,
): Promise<boolean> {
  let resolvedUserId = userId
  if (!resolvedUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    resolvedUserId = user?.id
  }

  if (!resolvedUserId) {
    console.error('Failed to mark pool read: no authenticated user')
    return false
  }

  const { error } = await supabase.from('pool_chat_reads').upsert(
    {
      pool_id: poolId,
      user_id: resolvedUserId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'pool_id,user_id' },
  )

  if (error) {
    console.error('Failed to mark pool read:', error.message)
    return false
  }
  return true
}

export function emitPoolMarkedRead(poolId: string) {
  window.dispatchEvent(
    new CustomEvent(POOL_MARKED_READ_EVENT, { detail: { poolId } }),
  )
}
