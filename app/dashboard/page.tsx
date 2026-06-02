import { redirect } from 'next/navigation'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { resolveUserDisplayName } from '@/src/lib/auth'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

type MembershipRow = {
  id: string
  pool_id: string
  pools: {
    id: string
    name: string
    invite_code: string
    creator_id: string
  } | null
}

function memberInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordReset?: string }>
}) {
  const { passwordReset } = await searchParams
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: memberships, error: memberError } = await supabase
    .from('pool_members')
    .select(
      `
      id,
      pool_id,
      pools (
        id,
        name,
        invite_code
        ,creator_id
      )
    `,
    )
    .eq('user_id', user.id)

  if (memberError) {
    console.error('Failed to fetch pool memberships:', memberError.message)
  }

  const memberRows = (memberships ?? []) as MembershipRow[]
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

  const predictionsByMember = new Map<string, number>()
  if (memberIds.length > 0) {
    const { data: predictions } = await supabase
      .from('predictions')
      .select('member_id, match_id')
      .in('member_id', memberIds)

    const distinctByMember = new Map<string, Set<string>>()
    for (const row of predictions ?? []) {
      if (!distinctByMember.has(row.member_id)) {
        distinctByMember.set(row.member_id, new Set())
      }
      distinctByMember.get(row.member_id)!.add(row.match_id)
    }
    for (const [memberId, matchIds] of distinctByMember) {
      predictionsByMember.set(memberId, matchIds.size)
    }
  }

  const rankByMember = new Map<string, number>()
  const pointsByMember = new Map<string, number>()
  const correctByMember = new Map<string, number>()
  if (memberIds.length > 0) {
    const { data: cacheRows } = await supabase
      .from('leaderboard_cache')
      .select('member_id, rank, total_points, correct_winners')
      .in('member_id', memberIds)

    for (const row of cacheRows ?? []) {
      rankByMember.set(row.member_id, row.rank)
      pointsByMember.set(row.member_id, row.total_points ?? 0)
      correctByMember.set(row.member_id, row.correct_winners ?? 0)
    }
  }

  const pools: DashboardPoolCardData[] = validMemberships.map((row) => {
    const pool = row.pools!
    const yourPredictions = predictionsByMember.get(row.id) ?? 0
    return {
      id: pool.id,
      name: pool.name,
      inviteCode: pool.invite_code,
      members: memberCountByPool.get(pool.id) ?? 1,
      memberAvatars: memberAvatarsByPool.get(pool.id) ?? [],
      yourRank: rankByMember.get(row.id) ?? null,
      totalPredictions,
      yourPredictions,
      nextMatchKickoffAt,
      predictionsLocked,
      canDelete: pool.creator_id === user.id,
    }
  })

  let totalPoints = 0
  let predictionsMade = 0
  let totalCorrect = 0
  for (const row of validMemberships) {
    totalPoints += pointsByMember.get(row.id) ?? 0
    predictionsMade += predictionsByMember.get(row.id) ?? 0
    totalCorrect += correctByMember.get(row.id) ?? 0
  }

  const winRate =
    predictionsMade > 0
      ? Math.round((totalCorrect / predictionsMade) * 100)
      : null

  return (
    <DashboardView
      userId={user.id}
      email={user.email ?? ''}
      displayName={resolveUserDisplayName(
        profile?.display_name,
        user.user_metadata,
      )}
      pools={pools}
      quickStats={{
        totalPoints,
        predictionsMade,
        winRate,
      }}
      passwordResetSuccess={passwordReset === 'success'}
      errorMessage={null}
    />
  )
}
