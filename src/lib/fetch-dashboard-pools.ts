import type { SupabaseClient } from '@supabase/supabase-js'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { resolveCurrentEventId } from '@/src/lib/current-event'
import { fetchMemberPredictionCounts } from '@/src/lib/member-prediction-counts'
import {
  buildPoolLeaderboardMembers,
  getMemberConsecutivePlace,
  poolHasLeaderboardResults,
  type LeaderboardCacheRow,
  type PoolLeaderboardMember,
} from '@/src/lib/pool-leaderboard'
import { getUpcomingHorizonEndIso } from '@/src/lib/upcoming-match-horizon'
import {
  computeWinnerOnlyDashboardProgress,
  parseStandingsJson,
  parseThirdPlaceRankingsJson,
  WINNER_ONLY_DASHBOARD_PROGRESS_TOTAL,
} from '@/src/lib/world-cup-groups'

type MembershipRow = {
  id: string
  pool_id: string
  pools: {
    id: string
    name: string
    invite_code: string
    creator_id: string
    event_name: string
    scoring_style: string
    is_official: boolean | null
  } | null
}

type PoolAvatarBatchRow = {
  member_id: string
  avatar: string | null
  custom_avatar_url: string | null
}

type RankMovementFields = {
  movement: 'up' | 'down' | 'none'
  rankDelta: number
}

function rankMovementFromCache(
  rank: number | null | undefined,
  prevRank: number | null | undefined,
): RankMovementFields {
  if (rank == null || prevRank == null || prevRank <= 0) {
    return { movement: 'none', rankDelta: 0 }
  }
  const delta = prevRank - rank
  if (delta > 0) return { movement: 'up', rankDelta: delta }
  if (delta < 0) return { movement: 'down', rankDelta: Math.abs(delta) }
  return { movement: 'none', rankDelta: 0 }
}

export async function fetchDashboardPools(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ pools: DashboardPoolCardData[]; error: string | null }> {
  const { data: memberships, error: memberError } = await supabase
    .from('pool_members')
    .select(
      `
      id,
      pool_id,
      pools (
        id,
        name,
        invite_code,
        creator_id,
        event_name,
        scoring_style,
        is_official
      )
    `,
    )
    .eq('user_id', userId)

  if (memberError) {
    console.error('Failed to fetch pool memberships:', memberError.message)
    return { pools: [], error: memberError.message }
  }

  const memberRows = (memberships ?? []) as unknown as MembershipRow[]
  const validMemberships = memberRows.filter((row) => row.pools != null)
  const poolIds = validMemberships.map((row) => row.pool_id)

  const eventId = await resolveCurrentEventId(supabase)

  let totalMatchQuery = supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
  if (eventId) totalMatchQuery = totalMatchQuery.eq('event_id', eventId)
  const { count: totalMatchCount } = await totalMatchQuery

  const totalPredictions = totalMatchCount ?? 0

  const nowIso = new Date().toISOString()
  const horizonEndIso = getUpcomingHorizonEndIso()

  let nextMatchQuery = supabase
    .from('matches')
    .select('kickoff_at')
    .gt('kickoff_at', nowIso)
    .lte('kickoff_at', horizonEndIso)
    .order('kickoff_at', { ascending: true })
    .limit(1)
  if (eventId) nextMatchQuery = nextMatchQuery.eq('event_id', eventId)
  const { data: nextMatch } = await nextMatchQuery.maybeSingle()

  const nextMatchKickoffAt = nextMatch?.kickoff_at ?? null

  let upcomingMatchQuery = supabase
    .from('matches')
    .select('id')
    .gt('kickoff_at', nowIso)
    .lte('kickoff_at', horizonEndIso)
  if (eventId) upcomingMatchQuery = upcomingMatchQuery.eq('event_id', eventId)
  const { data: upcomingMatchRows } = await upcomingMatchQuery

  const upcomingMatchIds = (upcomingMatchRows ?? []).map((row) => row.id)
  const upcomingMatchCount = upcomingMatchIds.length
  const predictionsLocked = upcomingMatchCount === 0

  let matchesPlayedQuery = supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('is_final', true)
  if (eventId) matchesPlayedQuery = matchesPlayedQuery.eq('event_id', eventId)
  const { count: matchesPlayed } = await matchesPlayedQuery

  const matchesPlayedCount = matchesPlayed ?? 0

  const memberCountByPool = new Map<string, number>()
  const memberAvatarsByPool = new Map<
    string,
    {
      displayName: string
      avatar: string | null
      customAvatarUrl: string | null
    }[]
  >()

  if (poolIds.length > 0) {
    const avatarByMemberId = new Map<
      string,
      { avatar: string | null; customAvatarUrl: string | null }
    >()
    const { data: avatarRows, error: avatarError } = await supabase.rpc(
      'get_pool_member_avatars_batch',
      { p_pool_ids: poolIds },
    )

    if (avatarError) {
      console.error(
        'Failed to load member avatars for dashboard pools:',
        avatarError.message,
      )
    } else {
      for (const row of (avatarRows ?? []) as PoolAvatarBatchRow[]) {
        avatarByMemberId.set(String(row.member_id), {
          avatar: row.avatar ?? null,
          customAvatarUrl: row.custom_avatar_url ?? null,
        })
      }
    }

    const { data: memberRowsAll } = await supabase
      .from('pool_members')
      .select('id, pool_id, display_name')
      .in('pool_id', poolIds)
      .order('joined_at', { ascending: true })

    for (const row of memberRowsAll ?? []) {
      memberCountByPool.set(
        row.pool_id,
        (memberCountByPool.get(row.pool_id) ?? 0) + 1,
      )

      const displayName = row.display_name?.trim() || 'Member'
      const avatarFields = avatarByMemberId.get(row.id)
      const avatars = memberAvatarsByPool.get(row.pool_id) ?? []
      avatars.push({
        displayName,
        avatar: avatarFields?.avatar ?? null,
        customAvatarUrl: avatarFields?.customAvatarUrl ?? null,
      })
      memberAvatarsByPool.set(row.pool_id, avatars)
    }
  }

  const memberContexts = validMemberships.map((row) => ({
    memberId: row.id,
    scoringStyle: row.pools!.scoring_style,
  }))

  const classicMemberContexts = memberContexts.filter(
    (row) => row.scoringStyle !== 'winner',
  )

  const { predictionsByMember } = await fetchMemberPredictionCounts(
    supabase,
    classicMemberContexts,
  )

  /** Classic: upcoming matches in horizon still missing a prediction. */
  const upcomingPicksNeededByMember = new Map<string, number>()
  if (classicMemberContexts.length > 0 && upcomingMatchIds.length > 0) {
    const classicMemberIds = classicMemberContexts.map((row) => row.memberId)
    const { data: upcomingPredictionRows } = await supabase
      .from('predictions')
      .select('member_id, match_id')
      .in('member_id', classicMemberIds)
      .in('match_id', upcomingMatchIds)

    const predictedUpcomingByMember = new Map<string, Set<string>>()
    for (const row of upcomingPredictionRows ?? []) {
      if (!predictedUpcomingByMember.has(row.member_id)) {
        predictedUpcomingByMember.set(row.member_id, new Set())
      }
      predictedUpcomingByMember.get(row.member_id)!.add(row.match_id)
    }

    for (const memberId of classicMemberIds) {
      const predicted = predictedUpcomingByMember.get(memberId)?.size ?? 0
      upcomingPicksNeededByMember.set(
        memberId,
        Math.max(0, upcomingMatchIds.length - predicted),
      )
    }
  }

  const winnerMemberships = validMemberships.filter(
    (row) => row.pools!.scoring_style === 'winner',
  )
  const winnerProgressByMember = new Map<string, number>()

  if (winnerMemberships.length > 0) {
    const winnerMemberIds = winnerMemberships.map((row) => row.id)
    const winnerPoolIds = winnerMemberships.map((row) => row.pool_id)

    const { data: groupRows } = await supabase
      .from('group_predictions')
      .select('member_id, standings')
      .in('member_id', winnerMemberIds)

    const standingsByMember = new Map<string, string[][]>()
    for (const row of groupRows ?? []) {
      const standings = parseStandingsJson(row.standings)
      const existing = standingsByMember.get(row.member_id) ?? []
      existing.push(standings)
      standingsByMember.set(row.member_id, existing)
    }

    const thirdPlaceByPool = new Map<string, string[]>()
    const { data: thirdPlaceRows } = await supabase
      .from('third_place_rankings')
      .select('pool_id, rankings')
      .in('pool_id', winnerPoolIds)
      .eq('user_id', userId)

    for (const row of thirdPlaceRows ?? []) {
      thirdPlaceByPool.set(
        row.pool_id,
        parseThirdPlaceRankingsJson(row.rankings),
      )
    }

    for (const row of winnerMemberships) {
      winnerProgressByMember.set(
        row.id,
        computeWinnerOnlyDashboardProgress(
          standingsByMember.get(row.id) ?? [],
          thirdPlaceByPool.get(row.pool_id) ?? [],
        ),
      )
    }
  }

  const poolMembersByPool = new Map<string, PoolLeaderboardMember[]>()
  const cacheRowsByPool = new Map<string, LeaderboardCacheRow[]>()

  if (poolIds.length > 0) {
    const { data: allPoolMemberRows } = await supabase
      .from('pool_members')
      .select('id, pool_id, user_id, display_name, joined_at')
      .in('pool_id', poolIds)

    for (const row of allPoolMemberRows ?? []) {
      const members = poolMembersByPool.get(row.pool_id) ?? []
      members.push({
        id: row.id,
        user_id: row.user_id,
        display_name: row.display_name?.trim() || 'Member',
        joined_at: row.joined_at,
      })
      poolMembersByPool.set(row.pool_id, members)
    }

    const { data: cacheRowsAll } = await supabase
      .from('leaderboard_cache')
      .select(
        'pool_id, rank, prev_rank, member_id, total_points, correct_winners',
      )
      .in('pool_id', poolIds)

    for (const row of cacheRowsAll ?? []) {
      const cacheRows = cacheRowsByPool.get(row.pool_id) ?? []
      cacheRows.push({
        rank: row.rank,
        prev_rank: row.prev_rank,
        member_id: row.member_id,
        total_points: row.total_points,
        correct_winners: row.correct_winners,
      })
      cacheRowsByPool.set(row.pool_id, cacheRows)
    }
  }

  const placeByMember = new Map<string, number>()
  const movementByMember = new Map<string, RankMovementFields>()
  for (const row of validMemberships) {
    const pool = row.pools!
    const isWinnerPool = pool.scoring_style === 'winner'
    const cacheRows = cacheRowsByPool.get(pool.id) ?? null
    const poolMembers = poolMembersByPool.get(pool.id) ?? []
    const leaderboardMembers = buildPoolLeaderboardMembers({
      poolMembers,
      creatorUserId: pool.creator_id,
      cacheRows,
      matchesPlayedCount,
      currentUserId: userId,
      predictionsByMember: new Map(),
      isWinnerPool,
      avatarsByMemberId: new Map(),
    })

    const myCache = cacheRows?.find((cacheRow) => cacheRow.member_id === row.id)
    movementByMember.set(
      row.id,
      rankMovementFromCache(myCache?.rank, myCache?.prev_rank),
    )

    if (
      !poolHasLeaderboardResults(
        leaderboardMembers,
        matchesPlayedCount,
        isWinnerPool,
      )
    ) {
      continue
    }

    const place = getMemberConsecutivePlace(leaderboardMembers, row.id)
    if (place != null) {
      placeByMember.set(row.id, place)
    }
  }

  const pools: DashboardPoolCardData[] = validMemberships.map((row) => {
    const pool = row.pools!
    const isWinnerPool = pool.scoring_style === 'winner'
    const yourPredictions = isWinnerPool
      ? (winnerProgressByMember.get(row.id) ?? 0)
      : (predictionsByMember.get(row.id) ?? 0)
    const poolTotalPredictions = isWinnerPool
      ? WINNER_ONLY_DASHBOARD_PROGRESS_TOTAL
      : totalPredictions
    const picksNeeded = predictionsLocked
      ? 0
      : isWinnerPool
        ? Math.max(0, poolTotalPredictions - yourPredictions)
        : (upcomingPicksNeededByMember.get(row.id) ?? upcomingMatchIds.length)
    const movementFields = movementByMember.get(row.id) ?? {
      movement: 'none' as const,
      rankDelta: 0,
    }
    return {
      id: pool.id,
      name: pool.name,
      eventName: pool.event_name || 'FIFA World Cup 2026',
      scoringStyle: pool.scoring_style,
      inviteCode: pool.invite_code,
      members: memberCountByPool.get(pool.id) ?? 1,
      memberAvatars: memberAvatarsByPool.get(pool.id) ?? [],
      yourRank: placeByMember.get(row.id) ?? null,
      movement: movementFields.movement,
      rankDelta: movementFields.rankDelta,
      totalPredictions: poolTotalPredictions,
      yourPredictions,
      picksNeeded,
      nextMatchKickoffAt,
      predictionsLocked,
      canDelete: pool.creator_id === userId,
      isOfficial: Boolean(pool.is_official),
    }
  })

  return { pools, error: null }
}
