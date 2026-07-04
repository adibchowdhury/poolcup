import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeaderboardPointBreakdownItem } from '@/components/pool/leaderboard-row'
import {
  deserializeWinnerLeaderboardBreakdown,
  type SerializedWinnerLeaderboardBreakdown,
} from '@/src/lib/winner-leaderboard-breakdown'

export async function fetchWinnerPoolLeaderboardBreakdownMobile(
  supabase: SupabaseClient,
  poolId: string,
): Promise<{
  breakdownByMember: Map<string, LeaderboardPointBreakdownItem[]>
  error: string | null
}> {
  const { data, error } = await supabase.rpc(
    'get_winner_pool_leaderboard_breakdown',
    { p_pool_id: poolId },
  )

  if (error) {
    console.error('Failed to load winner leaderboard breakdown:', error.message)
    return {
      breakdownByMember: new Map(),
      error: error.message,
    }
  }

  return {
    breakdownByMember: deserializeWinnerLeaderboardBreakdown(
      (data ?? {}) as SerializedWinnerLeaderboardBreakdown,
    ),
    error: null,
  }
}
