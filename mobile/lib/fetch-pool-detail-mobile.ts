import type { SupabaseClient } from '@supabase/supabase-js'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import type { LeaderboardMember, LeaderboardPointBreakdownItem } from '@/components/pool/leaderboard-row'
import { fetchMemberPredictionCounts } from '@/src/lib/member-prediction-counts'
import {
  buildPoolLeaderboardMembers,
  fetchPoolLeaderboardPointBreakdown,
  type LeaderboardCacheRow,
  type PoolLeaderboardMember,
} from '@/src/lib/pool-leaderboard'
import { fetchWinnerPoolLeaderboardBreakdownMobile } from './fetch-winner-pool-leaderboard-breakdown-mobile'

export type MobilePoolDetailMeta = {
  inviteCode: string
  name: string
  scoringStyle: string
  memberCount: number
  matchesPlayed: number
  acceptingMembers: boolean
  avatar: string | null
  creatorUserId: string
  /** Classic pools always expandable; winner pools only when RPC succeeds. */
  leaderboardBreakdownExpandable: boolean
}

export type MobilePoolDetailData = {
  meta: MobilePoolDetailMeta | null
  members: LeaderboardMember[]
  error: string | null
}

type AvatarRow = {
  member_id: string
  avatar: string | null
}

export async function fetchPoolDetailMobile(
  supabase: SupabaseClient,
  pool: DashboardPoolCardData,
  currentUserId: string,
): Promise<MobilePoolDetailData> {
  const { data: poolRow, error: poolError } = await supabase
    .from('pools')
    .select(
      'id, name, invite_code, creator_id, scoring_style, accepting_members, avatar',
    )
    .eq('id', pool.id)
    .maybeSingle()

  if (poolError) {
    return { meta: null, members: [], error: poolError.message }
  }

  if (!poolRow?.creator_id) {
    return { meta: null, members: [], error: 'Pool not found' }
  }

  const { data: membersData, error: membersError } = await supabase
    .from('pool_members')
    .select('id, user_id, display_name, joined_at')
    .eq('pool_id', pool.id)
    .order('joined_at', { ascending: true })

  if (membersError) {
    return { meta: null, members: [], error: membersError.message }
  }

  const poolMembers = (membersData ?? []) as PoolLeaderboardMember[]
  const isWinnerPool = poolRow.scoring_style === 'winner'

  const avatarByMemberId = new Map<string, string | null>()
  const { data: avatarRows, error: avatarError } = await supabase.rpc(
    'get_pool_member_avatars',
    { p_pool_id: pool.id },
  )

  if (avatarError) {
    console.error('Failed to load pool member avatars:', avatarError.message)
  } else {
    for (const row of (avatarRows ?? []) as AvatarRow[]) {
      avatarByMemberId.set(String(row.member_id), row.avatar ?? null)
    }
  }

  const { predictionsByMember } = await fetchMemberPredictionCounts(
    supabase,
    poolMembers.map((member) => ({
      memberId: member.id,
      scoringStyle: poolRow.scoring_style,
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
    return { meta: null, members: [], error: cacheError.message }
  }

  let breakdownByMember:
    | Map<string, LeaderboardPointBreakdownItem[]>
    | undefined
  let leaderboardBreakdownExpandable = !isWinnerPool

  if (!isWinnerPool) {
    const { breakdownByMember: loadedBreakdown, error: breakdownError } =
      await fetchPoolLeaderboardPointBreakdown(supabase, pool.id, 'classic')

    if (breakdownError) {
      console.error('Failed to load leaderboard breakdown:', breakdownError)
    }

    breakdownByMember = loadedBreakdown
  } else {
    const { breakdownByMember: loadedBreakdown, error: breakdownError } =
      await fetchWinnerPoolLeaderboardBreakdownMobile(supabase, pool.id)

    if (breakdownError) {
      console.error(
        'Failed to load winner leaderboard breakdown:',
        breakdownError,
      )
    } else {
      breakdownByMember = loadedBreakdown
      leaderboardBreakdownExpandable = true
    }
  }

  const members = buildPoolLeaderboardMembers({
    poolMembers,
    creatorUserId: poolRow.creator_id,
    cacheRows: (cacheData ?? []) as LeaderboardCacheRow[],
    matchesPlayedCount,
    currentUserId,
    predictionsByMember,
    isWinnerPool,
    avatarsByMemberId: avatarByMemberId,
    breakdownByMember,
  })

  const meta: MobilePoolDetailMeta = {
    inviteCode: poolRow.invite_code,
    name: poolRow.name,
    scoringStyle: poolRow.scoring_style,
    memberCount: poolMembers.length,
    matchesPlayed: matchesPlayedCount,
    acceptingMembers: poolRow.accepting_members ?? true,
    avatar: poolRow.avatar ?? null,
    creatorUserId: poolRow.creator_id,
    leaderboardBreakdownExpandable,
  }

  return { meta, members, error: null }
}
