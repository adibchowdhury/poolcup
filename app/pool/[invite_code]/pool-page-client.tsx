'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { eventHasLiveOrRecentFinalMatch } from '@/src/lib/featured-match'
import {
  buildPoolLeaderboardMembers,
  fetchPoolLeaderboardPointBreakdown,
  fetchWinnerPoolLeaderboardPointBreakdown,
  verifyLeaderboardBreakdownPointDerivation,
  verifyLeaderboardBreakdownTotals,
  type MemberAvatarRecord,
} from '@/src/lib/pool-leaderboard'
import {
  excludeBannedFromPoolLeaderboardInputs,
  fetchPoolBannedUserIdsClient,
} from '@/src/lib/banned-users'
import {
  fetchPoolAnnouncementsApi,
  type PoolAnnouncement,
} from '@/src/lib/pool-announcements'

/** Soft-refresh interval while an event match is live or recently final. */
const LEADERBOARD_LIVE_POLL_MS = 35_000

type LeaderboardRefreshContext = {
  poolId: string
  eventId: string | null
  scoringStyle: string
  creatorUserId: string
  poolMembers: PoolMember[]
  bannedUserIds: string[]
}

type Pool = {
  id: string
  name: string
  description: string | null
  invite_code: string
  creator_id: string
  scoring_style: string
  accepting_members: boolean | null
  avatar: string | null
  emblem_url: string | null
  theme_color: string | null
  event_id: string | null
  score_exact_points: number | null
  score_winner_points: number | null
  score_draw_points: number | null
  scoring_locked_at: string | null
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

export function PoolPageClient() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.invite_code as string
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const predictionsCompletedTrackedRef = useRef(false)
  const leaderboardRefreshCtxRef = useRef<LeaderboardRefreshContext | null>(
    null,
  )
  const avatarByMemberIdRef = useRef(new Map<string, MemberAvatarRecord>())
  const leaderboardRefreshInFlightRef = useRef(false)

  const [poolMeta, setPoolMeta] = useState<PoolHomeMeta | null>(null)
  const [members, setMembers] = useState<LeaderboardMember[]>([])
  const [userPredictions, setUserPredictions] = useState<UserPoolPrediction[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [leaderboardRefreshing, setLeaderboardRefreshing] = useState(false)
  const [leaderboardLiveSync, setLeaderboardLiveSync] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [poolId, setPoolId] = useState<string | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [canDelete, setCanDelete] = useState(false)
  const [avatarByMemberId, setAvatarByMemberId] = useState(
    () => new Map<string, MemberAvatarRecord>(),
  )
  const [poolCreatorUserId, setPoolCreatorUserId] = useState<string | null>(null)
  const [isPoolOwner, setIsPoolOwner] = useState(false)
  const [isPoolAdmin, setIsPoolAdmin] = useState(false)
  const [poolHasCommissionerTools, setPoolHasCommissionerTools] =
    useState(false)
  const [coAdminUserIds, setCoAdminUserIds] = useState<string[]>([])
  const [poolDescription, setPoolDescription] = useState<string | null>(null)
  const [memberProfilesByUserId, setMemberProfilesByUserId] = useState(
    () => new Map<string, PoolChatMemberProfile>(),
  )
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<PoolAnnouncement | null>(null)

  avatarByMemberIdRef.current = avatarByMemberId

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

  const handlePoolDescriptionChange = useCallback(
    (description: string | null) => {
      setPoolDescription(description)
      setPoolMeta((previous) =>
        previous ? { ...previous, description } : previous,
      )
    },
    [],
  )

  const handleAcceptingMembersChange = useCallback((acceptingMembers: boolean) => {
    setPoolMeta((previous) =>
      previous ? { ...previous, acceptingMembers } : previous,
    )
  }, [])

  const handleMemberRemoved = useCallback((removedMemberId: string) => {
    setMembers((previous) => previous.filter((m) => m.id !== removedMemberId))
    setPoolMeta((previous) =>
      previous
        ? {
            ...previous,
            memberCount: Math.max(0, previous.memberCount - 1),
          }
        : previous,
    )
  }, [])

  const handleOwnershipTransferred = useCallback(
    (newOwnerUserId: string) => {
      setPoolCreatorUserId(newOwnerUserId)
      setCanDelete(newOwnerUserId === userId)
      if (leaderboardRefreshCtxRef.current) {
        leaderboardRefreshCtxRef.current = {
          ...leaderboardRefreshCtxRef.current,
          creatorUserId: newOwnerUserId,
        }
      }
    },
    [userId],
  )

  const handleAnnouncementDismissed = useCallback(
    (announcementId: string) => {
      setActiveAnnouncement((previous) =>
        previous?.id === announcementId ? null : previous,
      )
      if (!poolId) return
      void fetchPoolAnnouncementsApi(poolId).then((result) => {
        if (!result.error) {
          setActiveAnnouncement(result.banner)
        }
      })
    },
    [poolId],
  )

  const handleManagedAnnouncementChange = useCallback(
    (announcement: PoolAnnouncement | null) => {
      setActiveAnnouncement(announcement)
    },
    [],
  )

  const handlePoolAvatarChange = useCallback((avatar: string) => {
    setPoolMeta((previous) => (previous ? { ...previous, avatar } : previous))
  }, [])

  const handlePoolThemeColorChange = useCallback((themeColor: string | null) => {
    setPoolMeta((previous) =>
      previous ? { ...previous, themeColor } : previous,
    )
  }, [])

  const handlePoolEmblemUrlChange = useCallback((emblemUrl: string | null) => {
    setPoolMeta((previous) =>
      previous ? { ...previous, emblemUrl } : previous,
    )
  }, [])

  const handlePoolScoringChange = useCallback(
    (scoring: {
      scoreExactPoints: number | null
      scoreWinnerPoints: number | null
      scoreDrawPoints: number | null
    }) => {
      setPoolMeta((previous) =>
        previous
          ? {
              ...previous,
              scoreExactPoints: scoring.scoreExactPoints,
              scoreWinnerPoints: scoring.scoreWinnerPoints,
              scoreDrawPoints: scoring.scoreDrawPoints,
            }
          : previous,
      )
    },
    [],
  )

  const loadPoolData = useCallback(async () => {
    if (!userId) return

    setPageLoading(true)
    setLeaderboardLoading(true)
    setNotFound(false)

    const { data: poolData, error: poolError } = await supabase
      .from('pools')
      .select(
        'id, name, description, invite_code, creator_id, scoring_style, accepting_members, avatar, emblem_url, theme_color, event_id, score_exact_points, score_winner_points, score_draw_points, scoring_locked_at',
      )
      .eq('invite_code', inviteCode)
      .maybeSingle()

    // Private invite holders (non-members) no longer pass pools_read RLS —
    // send them through the rate-limited service-role join flow instead of
    // a dead "not found" page. Invalid codes also land on /join (unavailable).
    if (poolError || !poolData) {
      router.replace(`/join/${encodeURIComponent(inviteCode)}`)
      return
    }

    const pool = poolData as Pool
    setPoolId(pool.id)
    setPoolCreatorUserId(pool.creator_id)
    setCanDelete(pool.creator_id === userId)
    setIsPoolOwner(pool.creator_id === userId)
    setIsPoolAdmin(pool.creator_id === userId)
    setPoolDescription(
      typeof pool.description === 'string' ? pool.description : null,
    )
    setCoAdminUserIds([])

    // Refine role via commissioner bootstrap (owner OR co-commissioner).
    void fetch(`/api/pools/${encodeURIComponent(pool.id)}/commissioner`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 403) {
            setIsPoolAdmin(false)
            setIsPoolOwner(pool.creator_id === userId)
            setCanDelete(pool.creator_id === userId)
            setPoolHasCommissionerTools(false)
          }
          return
        }
        const data = (await res.json()) as {
          role?: { isOwner?: boolean; isAdmin?: boolean }
          coCommissioners?: Array<{ userId: string }>
          pool?: { description?: string | null }
          poolHasCommissionerTools?: boolean
        }
        const owner = Boolean(data.role?.isOwner)
        const admin = Boolean(data.role?.isAdmin)
        setIsPoolOwner(owner)
        setIsPoolAdmin(admin)
        setPoolHasCommissionerTools(Boolean(data.poolHasCommissionerTools))
        setCanDelete(owner)
        setCoAdminUserIds(
          (data.coCommissioners ?? []).map((c) => c.userId).filter(Boolean),
        )
        if (data.pool && 'description' in data.pool) {
          setPoolDescription(data.pool.description ?? null)
        }
      })
      .catch(() => {
        /* keep creator-based fallback */
      })

    const activeAnnouncementPromise = fetchPoolAnnouncementsApi(pool.id).then(
      (result) => result.banner,
    )

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

    const { count: awardedPredictionCount } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', pool.id)
      .neq('points_awarded', 0)

    const hasAwardedPoints = (awardedPredictionCount ?? 0) > 0
    let scoringLockedAt = pool.scoring_locked_at ?? null
    const scoringLocked =
      Boolean(scoringLockedAt) ||
      hasAwardedPoints ||
      matchesPlayedCount > 0

    // Persist lock once scoring has started (creator RLS); computed check remains the safety net.
    if (
      scoringLocked &&
      !scoringLockedAt &&
      pool.creator_id === userId
    ) {
      const lockedAt = new Date().toISOString()
      const { error: lockError } = await supabase
        .from('pools')
        .update({ scoring_locked_at: lockedAt })
        .eq('id', pool.id)
      if (lockError) {
        console.error('Failed to stamp scoring_locked_at:', lockError.message)
      } else {
        scoringLockedAt = lockedAt
      }
    }

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
          'id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, team1_logo, team2_logo, group_name, round, result_team1, result_team2, is_final, advancing_team, status_short, elapsed_minute',
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
      description:
        typeof pool.description === 'string' ? pool.description : null,
      scoringStyle: pool.scoring_style,
      stage: currentStage,
      memberCount: poolMembers.length,
      matchesPlayed: matchesPlayedCount,
      totalMatches: totalMatches ?? 0,
      nextMatchIn,
      nextMatchKickoffAt,
      acceptingMembers: pool.accepting_members ?? true,
      avatar: pool.avatar ?? null,
      emblemUrl: pool.emblem_url ?? null,
      themeColor: pool.theme_color ?? null,
      eventId: pool.event_id,
      scoreExactPoints: pool.score_exact_points ?? null,
      scoreWinnerPoints: pool.score_winner_points ?? null,
      scoreDrawPoints: pool.score_draw_points ?? null,
      scoringLockedAt,
      scoringLocked,
    })
    setActiveAnnouncement(await activeAnnouncementPromise)
    setUserPredictions(loadedUserPredictions)
    setPageLoading(false)

    const { data: cacheData, error: cacheError } = await supabase
      .from('leaderboard_cache')
      .select(
        'rank, prev_rank, member_id, total_points, correct_winners, exact_scores, climb_streak',
      )
      .eq('pool_id', pool.id)
      .order('rank', { ascending: true })

    if (cacheError) {
      console.error('Failed to load leaderboard:', cacheError.message)
      setLeaderboardError(cacheError.message)
    } else {
      setLeaderboardError(null)
    }

    const bannedUserIds = await fetchPoolBannedUserIdsClient(pool.id)
    const {
      poolMembers: activePoolMembers,
      cacheRows: activeCacheRows,
    } = excludeBannedFromPoolLeaderboardInputs(
      poolMembers,
      cacheData ?? null,
      bannedUserIds,
    )

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
      poolMembers: activePoolMembers,
      creatorUserId: pool.creator_id,
      cacheRows: activeCacheRows,
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

    leaderboardRefreshCtxRef.current = {
      poolId: pool.id,
      eventId: pool.event_id,
      scoringStyle: pool.scoring_style,
      creatorUserId: pool.creator_id,
      poolMembers,
      bannedUserIds: [...bannedUserIds],
    }

    setMembers(leaderboardMembers)
    setLeaderboardLoading(false)
  }, [inviteCode, router, userId])
  const softRefreshLeaderboard = useCallback(async () => {
    const ctx = leaderboardRefreshCtxRef.current
    if (!ctx || !userId || leaderboardRefreshInFlightRef.current) return

    leaderboardRefreshInFlightRef.current = true
    setLeaderboardRefreshing(true)

    try {
      const isWinnerPool = ctx.scoringStyle === 'winner'
      const poolEventId = ctx.eventId

      const { predictionsByMember } = await fetchMemberPredictionCounts(
        supabase,
        ctx.poolMembers.map((member) => ({
          memberId: member.id,
          scoringStyle: ctx.scoringStyle,
        })),
      )

      let matchesPlayedQuery = supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('is_final', true)
      if (poolEventId) {
        matchesPlayedQuery = matchesPlayedQuery.eq('event_id', poolEventId)
      }
      const { count: matchesPlayed } = await matchesPlayedQuery
      const matchesPlayedCount = matchesPlayed ?? 0

      const { data: cacheData, error: cacheError } = await supabase
        .from('leaderboard_cache')
        .select(
        'rank, prev_rank, member_id, total_points, correct_winners, exact_scores, climb_streak',
      )
        .eq('pool_id', ctx.poolId)
        .order('rank', { ascending: true })

      if (cacheError) {
        console.error(
          'Failed to soft-refresh leaderboard:',
          cacheError.message,
        )
        setLeaderboardError(cacheError.message)
        return
      }

      setLeaderboardError(null)

      let breakdownByMember:
        | Map<string, LeaderboardPointBreakdownItem[]>
        | undefined

      if (isWinnerPool) {
        const { breakdownByMember: loadedBreakdown, error: breakdownError } =
          await fetchWinnerPoolLeaderboardPointBreakdown(ctx.poolId)
        if (breakdownError) {
          console.error(
            'Failed to soft-refresh winner breakdown:',
            breakdownError,
          )
        }
        breakdownByMember = loadedBreakdown
      } else {
        const { breakdownByMember: loadedBreakdown, error: breakdownError } =
          await fetchPoolLeaderboardPointBreakdown(
            supabase,
            ctx.poolId,
            'classic',
          )
        if (breakdownError) {
          console.error(
            'Failed to soft-refresh classic breakdown:',
            breakdownError,
          )
        }
        breakdownByMember = loadedBreakdown
      }

      const bannedUserIds = new Set(ctx.bannedUserIds)
      const {
        poolMembers: activePoolMembers,
        cacheRows: activeCacheRows,
      } = excludeBannedFromPoolLeaderboardInputs(
        ctx.poolMembers,
        cacheData ?? null,
        bannedUserIds,
      )

      const leaderboardMembers = buildPoolLeaderboardMembers({
        poolMembers: activePoolMembers,
        creatorUserId: ctx.creatorUserId,
        cacheRows: activeCacheRows,
        matchesPlayedCount,
        currentUserId: userId,
        predictionsByMember,
        isWinnerPool,
        avatarsByMemberId: avatarByMemberIdRef.current,
        breakdownByMember,
      })

      setMembers(leaderboardMembers)
      setPoolMeta((previous) =>
        previous
          ? { ...previous, matchesPlayed: matchesPlayedCount }
          : previous,
      )
    } finally {
      leaderboardRefreshInFlightRef.current = false
      setLeaderboardRefreshing(false)
    }
  }, [userId])

  useEffect(() => {
    if (authLoading) return

    if (!userId) {
      router.replace('/login')
      return
    }

    loadPoolData()
  }, [authLoading, userId, router, loadPoolData])

  // Safety net if pool bootstrap fails after RLS tighten.
  useEffect(() => {
    if (pageLoading || authLoading || !userId) return
    if (notFound || !poolMeta) {
      router.replace(`/join/${encodeURIComponent(inviteCode)}`)
    }
  }, [
    pageLoading,
    authLoading,
    userId,
    notFound,
    poolMeta,
    inviteCode,
    router,
  ])

  // Gated live refresh: cheap activity check every 35s; full soft-refetch only
  // when the event has a live or recently-finalized match.
  useEffect(() => {
    if (pageLoading || notFound || !poolId) return

    let cancelled = false

    const tick = async () => {
      const ctx = leaderboardRefreshCtxRef.current
      if (!ctx || cancelled) return

      const shouldRefresh = await eventHasLiveOrRecentFinalMatch(
        supabase,
        ctx.eventId,
      )
      if (cancelled) return

      setLeaderboardLiveSync(shouldRefresh)
      if (!shouldRefresh) return

      await softRefreshLeaderboard()
    }

    const intervalId = window.setInterval(() => {
      void tick()
    }, LEADERBOARD_LIVE_POLL_MS)

    // Show Live badge promptly without re-fetching (initial load just completed).
    void (async () => {
      const ctx = leaderboardRefreshCtxRef.current
      if (!ctx || cancelled) return
      const shouldRefresh = await eventHasLiveOrRecentFinalMatch(
        supabase,
        ctx.eventId,
      )
      if (!cancelled) setLeaderboardLiveSync(shouldRefresh)
    })()

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [pageLoading, notFound, poolId, softRefreshLeaderboard])

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
          <p className="text-lg font-semibold text-foreground">
            Taking you to join…
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            You’ll need to join this pool before you can view it.
          </p>
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
      leaderboardRefreshing={leaderboardRefreshing}
      leaderboardLiveSync={leaderboardLiveSync}
      leaderboardError={leaderboardError}
      onRetryLeaderboard={() => void softRefreshLeaderboard()}
      canDelete={canDelete}
      poolId={poolId ?? undefined}
      memberId={memberId ?? undefined}
      onPredictionSaved={handlePredictionSaved}
      onPredictionRemoved={handlePredictionRemoved}
      avatarsByMemberId={avatarByMemberId}
      poolCreatorUserId={poolCreatorUserId ?? undefined}
      memberProfilesByUserId={memberProfilesByUserId}
      isPoolOwner={isPoolOwner}
      isPoolAdmin={isPoolAdmin}
      poolHasCommissionerTools={poolHasCommissionerTools}
      coAdminUserIds={coAdminUserIds}
      onPoolNameChange={handlePoolNameChange}
      onPoolDescriptionChange={handlePoolDescriptionChange}
      onAcceptingMembersChange={handleAcceptingMembersChange}
      onPoolAvatarChange={handlePoolAvatarChange}
      onPoolThemeColorChange={handlePoolThemeColorChange}
      onPoolEmblemUrlChange={handlePoolEmblemUrlChange}
      onPoolScoringChange={handlePoolScoringChange}
      onMemberRemoved={handleMemberRemoved}
      onOwnershipTransferred={handleOwnershipTransferred}
      activeAnnouncement={activeAnnouncement}
      onAnnouncementDismissed={handleAnnouncementDismissed}
      onManagedAnnouncementChange={handleManagedAnnouncementChange}
    />
  )
}
