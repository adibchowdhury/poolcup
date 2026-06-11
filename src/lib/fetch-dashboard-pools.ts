import type { SupabaseClient } from '@supabase/supabase-js'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { fetchMemberPredictionCounts } from '@/src/lib/member-prediction-counts'

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
  } | null
}

function memberInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
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
        scoring_style
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
  const memberIds = validMemberships.map((row) => row.id)
  const poolIds = validMemberships.map((row) => row.pool_id)

  const { count: totalMatchCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })

  const totalPredictions = totalMatchCount ?? 0

  const nowIso = new Date().toISOString()

  const { data: nextMatch } = await supabase
    .from('matches')
    .select('kickoff_at')
    .gt('kickoff_at', nowIso)
    .order('kickoff_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const nextMatchKickoffAt = nextMatch?.kickoff_at ?? null

  const { count: upcomingMatchCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .gt('kickoff_at', nowIso)

  const predictionsLocked = (upcomingMatchCount ?? 0) === 0

  const memberCountByPool = new Map<string, number>()
  const memberAvatarsByPool = new Map<
    string,
    { displayName: string; initials: string }[]
  >()

  if (poolIds.length > 0) {
    const { data: memberRowsAll } = await supabase
      .from('pool_members')
      .select('pool_id, display_name')
      .in('pool_id', poolIds)
      .order('joined_at', { ascending: true })

    for (const row of memberRowsAll ?? []) {
      memberCountByPool.set(
        row.pool_id,
        (memberCountByPool.get(row.pool_id) ?? 0) + 1,
      )

      const displayName = row.display_name?.trim() || 'Member'
      const avatars = memberAvatarsByPool.get(row.pool_id) ?? []
      avatars.push({
        displayName,
        initials: memberInitials(displayName),
      })
      memberAvatarsByPool.set(row.pool_id, avatars)
    }
  }

  const memberContexts = validMemberships.map((row) => ({
    memberId: row.id,
    scoringStyle: row.pools!.scoring_style,
  }))

  const { predictionsByMember } = await fetchMemberPredictionCounts(
    supabase,
    memberContexts,
  )

  const rankByMember = new Map<string, number>()
  if (memberIds.length > 0) {
    const { data: cacheRows } = await supabase
      .from('leaderboard_cache')
      .select('member_id, rank')
      .in('member_id', memberIds)

    for (const row of cacheRows ?? []) {
      rankByMember.set(row.member_id, row.rank)
    }
  }

  const pools: DashboardPoolCardData[] = validMemberships.map((row) => {
    const pool = row.pools!
    const yourPredictions = predictionsByMember.get(row.id) ?? 0
    return {
      id: pool.id,
      name: pool.name,
      eventName: pool.event_name || 'FIFA World Cup 2026',
      scoringStyle: pool.scoring_style,
      inviteCode: pool.invite_code,
      members: memberCountByPool.get(pool.id) ?? 1,
      memberAvatars: memberAvatarsByPool.get(pool.id) ?? [],
      yourRank: rankByMember.get(row.id) ?? null,
      totalPredictions,
      yourPredictions,
      nextMatchKickoffAt,
      predictionsLocked,
      canDelete: pool.creator_id === userId,
    }
  })

  return { pools, error: null }
}
