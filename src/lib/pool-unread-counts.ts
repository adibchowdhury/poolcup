import type { SupabaseClient } from '@supabase/supabase-js'

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

export async function markPoolRead(
  supabase: SupabaseClient,
  poolId: string,
): Promise<boolean> {
  const { error } = await supabase.rpc('mark_pool_read', { p_pool_id: poolId })
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
