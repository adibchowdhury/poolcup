'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'
import {
  PoolHomeView,
  type PoolHomeMeta,
} from '@/components/pool/pool-home-view'
import type { PoolChatMemberProfile } from '@/components/pool/pool-chat-tab'
import { PoolPageSkeleton } from '@/components/pool/pool-page-skeleton'
import type {
  LeaderboardMember,
  LeaderboardPointBreakdownItem,
} from '@/components/pool/leaderboard-row'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { deriveCurrentTournamentStage } from '@/src/lib/tournament-round-labels'
import { fetchMemberPredictionCounts } from '@/src/lib/member-prediction-counts'
import {
  mergeMatchesWithPredictions,
  type ClassicMatchRow,
  type ClassicPredictionRow,
  allClassicPredictionsComplete,
  hasStoredClassicMatchPrediction,
} from '@/src/lib/merge-classic-match-predictions'
import { capturePostHog } from '@/src/lib/posthog-client'
import {
  buildPoolLeaderboardMembers,
  fetchPoolLeaderboardPointBreakdown,
  fetchWinnerPoolLeaderboardPointBreakdown,
  verifyLeaderboardBreakdownPointDerivation,
  verifyLeaderboardBreakdownTotals,
  type MemberAvatarRecord,
} from '@/src/lib/pool-leaderboard'

type Pool = {
  id: string
  name: string
  invite_code: string
  creator_id: string
  scoring_style: string
  accepting_members: boolean | null
  avatar: string | null
  event_id: string | null
}

type PoolMember = {
  id: string
  user_id: string
  display_name: string
  joined_at: string
}

type MatchForPrediction = ClassicMatchRow

function formatTimeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Soon'
  const totalMinutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function PoolPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.invite_code as string
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const predictionsCompletedTrackedRef = useRef(false)

  const [poolMeta, setPoolMeta] = useState<PoolHomeMeta | null>(null)
  const [members, setMembers] = useState<LeaderboardMember[]>([])
  const [userPredictions, setUserPredictions] = useState<UserPoolPrediction[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [poolId, setPoolId] = useState<string | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [canDelete, setCanDelete] = useState(false)
  const [avatarByMemberId, setAvatarByMemberId] = useState(
    () => new Map<string, MemberAvatarRecord>(),
  )
  const [poolCreatorUserId, setPoolCreatorUserId] = useState<string | null>(null)
  const [memberProfilesByUserId, setMemberProfilesByUserId] = useState(
    () => new Map<string, PoolChatMemberProfile>(),
  )

  const handlePredictionSaved = useCallback(
    (
      matchId: string,
      predTeam1: number,
      predTeam2: number,
      advancePick?: number | null,
    ) => {
      setUserPredictions((previous) => {
        const updated = previous.map((prediction) =>
          prediction.matchId === matchId
            ? {
                ...prediction,
                predTeam1,
                predTeam2,
                ...(advancePick !== undefined ? { advancePick } : {}),
              }
            : prediction,
        )

        if (
          poolMeta?.scoringStyle !== 'winner' &&
          allClassicPredictionsComplete(updated) &&
          !predictionsCompletedTrackedRef.current &&
          poolId
        ) {
          capturePostHog('predictions_completed', { pool_id: poolId })
          predictionsCompletedTrackedRef.current = true
        }

        return updated
      })
    },
    [poolMeta?.scoringStyle, poolId],
  )

  const handlePredictionRemoved = useCallback((matchId: string) => {
    setUserPredictions((previous) =>
      previous.map((prediction) =>
        prediction.matchId === matchId
          ? {
              ...prediction,
              predTeam1: null,
              predTeam2: null,
              advancePick: null,
              pointsAwarded: null,
            }
          : prediction,
      ),
    )
  }, [])

  const handlePoolNameChange = useCallback((name: string) => {
    setPoolMeta((previous) => (previous ? { ...previous, name } : previous))
  }, [])

  const handleAcceptingMembersChange = useCallback((acceptingMembers: boolean) => {
    setPoolMeta((previous) =>
      previous ? { ...previous, acceptingMembers } : previous,
    )
  }, [])

  const handlePoolAvatarChange = useCallback((avatar: string) => {
    setPoolMeta((previous) => (previous ? { ...previous, avatar } : previous))
  }, [])

  const loadPoolData = useCallback(async () => {
    if (!userId) return

    setPageLoading(true)
    setLeaderboardLoading(true)
    setNotFound(false)

    const { data: poolData, error: poolError } = await supabase
      .from('pools')
      .select(
        'id, name, invite_code, creator_id, scoring_style, accepting_members, avatar, event_id',
      )
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (poolError || !poolData) {
      setPoolMeta(null)
      setMembers([])
      setAvatarByMemberId(new Map())
      setNotFound(true)
      setPageLoading(false)
      setLeaderboardLoading(false)
      return
    }

    const pool = poolData as Pool
    setPoolId(pool.id)
    setPoolCreatorUserId(pool.creator_id)
    setCanDelete(pool.creator_id === userId)

    const { data: membersData, error: membersError } = await supabase
      .from('pool_members')
      .select('id, user_id, display_name, joined_at')
      .eq('pool_id', pool.id)
      .order('joined_at', { ascending: true })

    if (membersError) {
      console.error('Failed to load members:', membersError.message)
    }

    const poolMembers = (membersData ?? []) as PoolMember[]

    const avatarByMemberId = new Map<string, MemberAvatarRecord>()
    const { data: avatarRows, error: avatarError } = await supabase.rpc(
      'get_pool_member_avatars',
      { p_pool_id: pool.id },
    )

    if (avatarError) {
      console.error('Failed to load member avatars:', avatarError.message)
    } else {
      for (const row of avatarRows ?? []) {
        const memberId = String(row.member_id)
        avatarByMemberId.set(memberId, {
          avatar: row.avatar ?? null,
          customAvatarUrl: row.custom_avatar_url ?? null,
        })
      }
    }

    setAvatarByMemberId(avatarByMemberId)

    const profilesByUserId = new Map<string, PoolChatMemberProfile>()
    for (const member of poolMembers) {
      const avatarFields = avatarByMemberId.get(member.id)
      profilesByUserId.set(member.user_id, {
        displayName: member.display_name,
        avatar: avatarFields?.avatar ?? null,
        customAvatarUrl: avatarFields?.customAvatarUrl ?? null,
      })
    }
    setMemberProfilesByUserId(profilesByUserId)

    const isWinnerPool = pool.scoring_style === 'winner'
    const poolEventId = pool.event_id

    const { predictionsByMember } = await fetchMemberPredictionCounts(
      supabase,
      poolMembers.map((member) => ({
        memberId: member.id,
        scoringStyle: pool.scoring_style,
      })),
    )

    let totalMatchQuery = supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
    if (poolEventId) totalMatchQuery = totalMatchQuery.eq('event_id', poolEventId)
    const { count: totalMatches } = await totalMatchQuery

    let matchesPlayedQuery = supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('is_final', true)
    if (poolEventId) matchesPlayedQuery = matchesPlayedQuery.eq('event_id', poolEventId)
    const { count: matchesPlayed } = await matchesPlayedQuery

    const matchesPlayedCount = matchesPlayed ?? 0

    let stageMatchQuery = supabase
      .from('matches')
      .select('round, kickoff_at, is_final')
      .order('kickoff_at', { ascending: true })
    if (poolEventId) stageMatchQuery = stageMatchQuery.eq('event_id', poolEventId)
    const { data: stageMatchRows } = await stageMatchQuery

    const currentStage = deriveCurrentTournamentStage(
      (stageMatchRows ?? []) as Pick<
        MatchForPrediction,
        'round' | 'kickoff_at' | 'is_final'
      >[],
    )

    let nextMatchIn: string | null = null
    let nextMatchKickoffAt: string | null = null
    let nextMatchQuery = supabase
      .from('matches')
      .select('kickoff_at')
      .gt('kickoff_at', new Date().toISOString())
      .order('kickoff_at', { ascending: true })
      .limit(1)
    if (poolEventId) nextMatchQuery = nextMatchQuery.eq('event_id', poolEventId)
    const { data: nextMatch } = await nextMatchQuery.maybeSingle()

    if (nextMatch?.kickoff_at) {
      nextMatchKickoffAt = nextMatch.kickoff_at
      nextMatchIn = formatTimeUntil(nextMatch.kickoff_at)
    }

    const currentMember = poolMembers.find((m) => m.user_id === userId)
    setMemberId(currentMember?.id ?? null)
    let loadedUserPredictions: UserPoolPrediction[] = []

    if (currentMember && pool.scoring_style !== 'winner') {
      let classicMatchesQuery = supabase
        .from('matches')
        .select(
          'id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, group_name, round, result_team1, result_team2, is_final, advancing_team',
        )
        .order('kickoff_at', { ascending: true })
      if (poolEventId) {
        classicMatchesQuery = classicMatchesQuery.eq('event_id', poolEventId)
      }

      const [matchesResult, userPredResult] = await Promise.all([
        classicMatchesQuery,
        supabase
          .from('predictions')
          .select(
            'match_id, pred_team1, pred_team2, advance_pick, points_awarded',
          )
          .eq('pool_id', pool.id)
          .eq('member_id', currentMember.id),
      ])

      if (matchesResult.error) {
        console.error(
          'Failed to load matches for predictions:',
          matchesResult.error.message,
        )
      }

      if (userPredResult.error) {
        console.error('Failed to load user predictions:', userPredResult.error.message)
      }

      const matchRows = (matchesResult.data ?? []) as ClassicMatchRow[]
      const predictionRows = (userPredResult.data ?? []) as ClassicPredictionRow[]

      loadedUserPredictions = mergeMatchesWithPredictions(matchRows, predictionRows)
    }

    setPoolMeta({
      inviteCode: pool.invite_code,
      name: pool.name,
      scoringStyle: pool.scoring_style,
      stage: currentStage,
      memberCount: poolMembers.length,
      matchesPlayed: matchesPlayedCount,
      totalMatches: totalMatches ?? 0,
      nextMatchIn,
      nextMatchKickoffAt,
      acceptingMembers: pool.accepting_members ?? true,
      avatar: pool.avatar ?? null,
      eventId: pool.event_id,
    })
    setUserPredictions(loadedUserPredictions)
    setPageLoading(false)

    const { data: cacheData, error: cacheError } = await supabase
      .from('leaderboard_cache')
      .select('rank, prev_rank, member_id, total_points, correct_winners')
      .eq('pool_id', pool.id)
      .order('rank', { ascending: true })

    if (cacheError) {
      console.error('Failed to load leaderboard:', cacheError.message)
    }

    let breakdownByMember: Map<string, LeaderboardPointBreakdownItem[]> | undefined

    if (isWinnerPool) {
      const { breakdownByMember: loadedBreakdown, error: breakdownError } =
        await fetchWinnerPoolLeaderboardPointBreakdown(pool.id)

      if (breakdownError) {
        console.error(
          'Failed to load winner leaderboard breakdown:',
          breakdownError,
        )
      }

      breakdownByMember = loadedBreakdown
    } else {
      const { breakdownByMember: loadedBreakdown, error: breakdownError } =
        await fetchPoolLeaderboardPointBreakdown(supabase, pool.id, 'classic')

      if (breakdownError) {
        console.error('Failed to load leaderboard breakdown:', breakdownError)
      }

      breakdownByMember = loadedBreakdown
    }

    const leaderboardMembers = buildPoolLeaderboardMembers({
      poolMembers,
      creatorUserId: pool.creator_id,
      cacheRows: cacheData ?? null,
      matchesPlayedCount,
      currentUserId: userId,
      predictionsByMember,
      isWinnerPool,
      avatarsByMemberId: avatarByMemberId,
      breakdownByMember,
    })

    const verification = verifyLeaderboardBreakdownTotals(leaderboardMembers)
    if (!verification.ok) {
      console.error(
        'Leaderboard breakdown totals do not match header points:',
        verification.mismatches,
      )
    }

    if (!isWinnerPool) {
      const derivation = verifyLeaderboardBreakdownPointDerivation(
        leaderboardMembers,
        'classic',
      )
      if (!derivation.ok) {
        console.warn(
          'Leaderboard breakdown helper points differ from points_awarded (display uses points_awarded):',
          derivation.divergences,
        )
      }
    }

    setMembers(leaderboardMembers)
    setLeaderboardLoading(false)
  }, [inviteCode, userId])

  useEffect(() => {
    if (authLoading) return

    if (!userId) {
      router.replace('/login')
      return
    }

    loadPoolData()
  }, [authLoading, userId, router, loadPoolData])

  if (authLoading || (!user && !notFound)) {
    return <PoolPageSkeleton />
  }

  if (pageLoading) {
    return <PoolPageSkeleton />
  }

  if (notFound || !poolMeta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Pool not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link may be invalid.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <PoolHomeView
      pool={poolMeta}
      members={members}
      userPredictions={userPredictions}
      currentUserId={user!.id}
      leaderboardLoading={leaderboardLoading}
      canDelete={canDelete}
      poolId={poolId ?? undefined}
      memberId={memberId ?? undefined}
      onPredictionSaved={handlePredictionSaved}
      onPredictionRemoved={handlePredictionRemoved}
      avatarsByMemberId={avatarByMemberId}
      poolCreatorUserId={poolCreatorUserId ?? undefined}
      memberProfilesByUserId={memberProfilesByUserId}
      onPoolNameChange={handlePoolNameChange}
      onAcceptingMembersChange={handleAcceptingMembersChange}
      onPoolAvatarChange={handlePoolAvatarChange}
    />
  )
}
