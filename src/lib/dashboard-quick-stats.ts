import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchMemberPredictionCounts,
  sumMemberCounts,
} from '@/src/lib/member-prediction-counts'

export type DashboardQuickStats = {
  totalPoints: number
  predictionsMade: number
  winRate: number | null
}

type MembershipRow = {
  id: string
  pools: { scoring_style: string } | { scoring_style: string }[] | null
}

export async function fetchDashboardQuickStats(
  supabase: SupabaseClient,
  userId: string,
  totalPoints: number,
): Promise<DashboardQuickStats> {
  const { data: memberships, error: memberError } = await supabase
    .from('pool_members')
    .select('id, pools(scoring_style)')
    .eq('user_id', userId)

  if (memberError) {
    console.error('Failed to fetch pool memberships:', memberError.message)
  }

  const memberRows = (memberships ?? []) as MembershipRow[]
  const memberContexts = memberRows.flatMap((row) => {
    const poolRaw = row.pools
    const pool = Array.isArray(poolRaw) ? poolRaw[0] : poolRaw
    if (!pool) return []
    return [{ memberId: row.id, scoringStyle: pool.scoring_style }]
  })
  const memberIds = memberContexts.map((row) => row.memberId)

  const { predictionsByMember, classicMatchPredictionsByMember } =
    await fetchMemberPredictionCounts(supabase, memberContexts)

  const correctByMember = new Map<string, number>()
  if (memberIds.length > 0) {
    const { data: cacheRows } = await supabase
      .from('leaderboard_cache')
      .select('member_id, correct_winners')
      .in('member_id', memberIds)

    for (const row of cacheRows ?? []) {
      correctByMember.set(row.member_id, row.correct_winners ?? 0)
    }
  }

  const predictionsMade = sumMemberCounts(memberIds, predictionsByMember)
  const classicMatchPredictionsMade = sumMemberCounts(
    memberIds,
    classicMatchPredictionsByMember,
  )
  const totalCorrect = sumMemberCounts(memberIds, correctByMember)

  const winRate =
    classicMatchPredictionsMade > 0
      ? Math.round((totalCorrect / classicMatchPredictionsMade) * 100)
      : null

  return { totalPoints, predictionsMade, winRate }
}
