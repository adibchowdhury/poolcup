import type { SupabaseClient } from '@supabase/supabase-js'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import { buildLeaderboardPlaceGroups } from '@/components/pool/leaderboard-grouped-list'
import { fetchMemberPredictionCounts } from '@/src/lib/member-prediction-counts'
import {
  buildPoolLeaderboardMembers,
  type LeaderboardCacheRow,
  type PoolLeaderboardMember,
} from '@/src/lib/pool-leaderboard'

export type MobilePoolStandingRow = {
  rank: number
  name: string
  points: number
  isYou: boolean
}

function memberInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
}

/**
 * Copied from app/pool/[invite_code]/page.tsx leaderboard load path:
 * pool_members + leaderboard_cache + matches played + buildPoolLeaderboardMembers.
 * Omits point breakdown (not needed for standings list).
 */
export async function fetchPoolStandingsMobile(
  supabase: SupabaseClient,
  pool: DashboardPoolCardData,
  currentUserId: string,
): Promise<{ standings: MobilePoolStandingRow[]; error: string | null }> {
  const { data: poolRow, error: poolError } = await supabase
    .from('pools')
    .select('creator_id')
    .eq('id', pool.id)
    .maybeSingle()

  if (poolError) {
    return { standings: [], error: poolError.message }
  }

  if (!poolRow?.creator_id) {
    return { standings: [], error: 'Pool not found' }
  }

  const { data: membersData, error: membersError } = await supabase
    .from('pool_members')
    .select('id, user_id, display_name, joined_at')
    .eq('pool_id', pool.id)
    .order('joined_at', { ascending: true })

  if (membersError) {
    return { standings: [], error: membersError.message }
  }

  const poolMembers = (membersData ?? []) as PoolLeaderboardMember[]
  const isWinnerPool = pool.scoringStyle === 'winner'

  const { predictionsByMember } = await fetchMemberPredictionCounts(
    supabase,
    poolMembers.map((member) => ({
      memberId: member.id,
      scoringStyle: pool.scoringStyle,
    })),
  )

  const { count: matchesPlayed } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('is_final', true)

  const matchesPlayedCount = matchesPlayed ?? 0

  const { data: cacheData, error: cacheError } = await supabase
    .from('leaderboard_cache')
    .select('rank, prev_rank, member_id, total_points, correct_winners')
    .eq('pool_id', pool.id)
    .order('rank', { ascending: true })

  if (cacheError) {
    return { standings: [], error: cacheError.message }
  }

  const leaderboardMembers = buildPoolLeaderboardMembers({
    poolMembers,
    creatorUserId: poolRow.creator_id,
    cacheRows: (cacheData ?? []) as LeaderboardCacheRow[],
    matchesPlayedCount,
    currentUserId,
    predictionsByMember,
    isWinnerPool,
    avatarsByMemberId: new Map(),
  })

  const standings = flattenStandings(leaderboardMembers)
  return { standings, error: null }
}

function flattenStandings(members: LeaderboardMember[]): MobilePoolStandingRow[] {
  const groups = buildLeaderboardPlaceGroups(members)
  const rows: MobilePoolStandingRow[] = []

  for (const group of groups) {
    for (const member of group.members) {
      rows.push({
        rank: group.place,
        name: member.name,
        points: member.points,
        isYou: member.isYou,
      })
    }
  }

  rows.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
  return rows
}

export { memberInitials }
