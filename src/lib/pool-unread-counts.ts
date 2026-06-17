import type { SupabaseClient } from '@supabase/supabase-js'

export const POOL_MARKED_READ_EVENT = 'pool-marked-read'

type PoolUnreadCountRow = {
  pool_id: string
  unread_count: number
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

export function markPoolRead(supabase: SupabaseClient, poolId: string) {
  return supabase.rpc('mark_pool_read', { p_pool_id: poolId })
}

export function emitPoolMarkedRead(poolId: string) {
  window.dispatchEvent(
    new CustomEvent(POOL_MARKED_READ_EVENT, { detail: { poolId } }),
  )
}
