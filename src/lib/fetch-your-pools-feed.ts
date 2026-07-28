import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DashboardPoolCardData,
  RankMovement,
} from '@/components/dashboard/pool-card'
import { fetchDashboardPools } from '@/src/lib/fetch-dashboard-pools'
import { fetchPoolUnreadCounts } from '@/src/lib/pool-unread-counts'

export type YourPoolsFeedItem = DashboardPoolCardData & {
  unreadCount: number
  movement: RankMovement
  rankDelta: number
}

export async function fetchYourPoolsFeed(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ pools: YourPoolsFeedItem[]; error: string | null }> {
  const [{ pools, error }, unreadByPoolId] = await Promise.all([
    fetchDashboardPools(supabase, userId),
    fetchPoolUnreadCounts(supabase),
  ])

  return {
    pools: pools.map((pool) => ({
      ...pool,
      unreadCount: unreadByPoolId.get(pool.id) ?? 0,
    })),
    error,
  }
}
