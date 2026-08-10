'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  GlobalMatchDetailView,
  type GlobalMatchDisplay,
} from '@/components/match/global-match-detail-view'
import type { ClassicMatchRow } from '@/src/lib/merge-classic-match-predictions'
import { deriveGlobalMatchPhase } from '@/src/lib/global-match-phase'
import { isMatchLocked } from '@/src/lib/match-lock'
import {
  buildPoolMatchDistribution,
  buildMockMatchHub,
  fetchAdjacentEventMatches,
  fetchFriendsMatchPredictions,
  fetchHeadToHead,
  fetchMatchCommonScores,
  fetchMatchCompetitionPools,
  fetchMatchConsensus,
  fetchMatchEventInfo,
  fetchMyMatchPickPoints,
  fetchTeamForm,
  USE_MOCK_HUB,
  writableScorePoolsFromCompetition,
  type AdjacentMatchNav,
  type FriendMatchPrediction,
  type HeadToHeadData,
  type MatchCommonScore,
  type MatchConsensus,
  type MatchEventInfo,
  type MatchRelatedPool,
  type PoolMatchDistribution,
  type TeamFormEntry,
} from '@/src/lib/match-hub-data'
import { fetchMatchPoolPicks } from '@/src/lib/match-pool-picks'
import {
  fetchMyMatchPredictions,
  type MyMatchPredictions,
} from '@/src/lib/my-match-predictions'
import { normalizeMatchScoringStyle } from '@/src/lib/prediction-scoring'
import {
  fetchRosterForTeamLogo,
  type TeamRosterPlayer,
} from '@/src/lib/team-roster'
import type { WritableScorePool } from '@/components/match/match-hub-panels'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { useAuth } from '@/src/lib/auth-context'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'

const MATCH_COLUMNS =
  'id, event_id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, team1_logo, team2_logo, group_name, round, result_team1, result_team2, is_final, advancing_team, status_short, elapsed_minute'

const LIVE_REFETCH_MS = 30_000

type MatchRowWithEvent = ClassicMatchRow & {
  event_id?: string | null
}

type HubBundle = {
  consensus: MatchConsensus | null
  commonScores: MatchCommonScore[]
  friends: FriendMatchPrediction[]
  myPredictions: MyMatchPredictions | null
  myPickPoints: number | null
  writablePools: WritableScorePool[]
  competitionPools: MatchRelatedPool[]
  poolDistributions: PoolMatchDistribution[]
  team1Form: TeamFormEntry[]
  team2Form: TeamFormEntry[]
  headToHead: HeadToHeadData | null
  adjacent: AdjacentMatchNav
}

const EMPTY_HUB: HubBundle = {
  consensus: null,
  commonScores: [],
  friends: [],
  myPredictions: null,
  myPickPoints: null,
  writablePools: [],
  competitionPools: [],
  poolDistributions: [],
  team1Form: [],
  team2Form: [],
  headToHead: null,
  adjacent: { prev: null, next: null },
}

function GlobalMatchPageSkeleton() {
  return (
    <div
      className={cn('min-h-screen bg-app-background', MOBILE_BOTTOM_NAV_PAD_CLASS)}
      aria-busy="true"
      aria-label="Loading match"
    >
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ShimmerBlock className="mb-4 h-14 w-full rounded-xl" />
        <ShimmerBlock className="mb-4 h-56 w-full rounded-2xl" />
        <ShimmerBlock className="mb-3 h-10 w-full rounded-xl" />
        <ShimmerBlock className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function toGlobalMatchDisplay(match: MatchRowWithEvent): GlobalMatchDisplay {
  return {
    team1Name: match.team1_name,
    team2Name: match.team2_name,
    team1Flag: match.team1_flag,
    team2Flag: match.team2_flag,
    team1Logo: match.team1_logo ?? null,
    team2Logo: match.team2_logo ?? null,
    kickoffAt: match.kickoff_at,
    lockedAt: match.locked_at ?? null,
    round: match.round,
    groupName: match.group_name,
    resultTeam1: match.result_team1,
    resultTeam2: match.result_team2,
    advancingTeam: match.advancing_team,
    statusShort: match.status_short,
    elapsedMinute: match.elapsed_minute,
    eventId: match.event_id ?? null,
  }
}

async function loadPoolDistributions(
  matchRow: MatchRowWithEvent,
  competitionPools: MatchRelatedPool[],
): Promise<PoolMatchDistribution[]> {
  const yours = competitionPools.filter((pool) => pool.isYours && pool.memberId)
  if (yours.length === 0) return []

  const results = await Promise.all(
    yours.map(async (pool) => {
      const { picks, error } = await fetchMatchPoolPicks(
        supabase,
        pool.id,
        matchRow.id,
        {
          isFinal: Boolean(matchRow.is_final),
          resultTeam1: matchRow.result_team1,
          resultTeam2: matchRow.result_team2,
          scoringStyle: normalizeMatchScoringStyle(pool.scoringStyle),
          round: matchRow.round,
          advancingTeam: matchRow.advancing_team,
        },
      )
      if (error || picks.length === 0) return null
      return buildPoolMatchDistribution(pool, picks)
    }),
  )

  return results.filter((row): row is PoolMatchDistribution => row != null)
}

async function loadHubBundle(
  matchId: string,
  matchRow: MatchRowWithEvent,
  userId: string | null,
): Promise<{ hub: HubBundle; error: string | null }> {
  if (USE_MOCK_HUB) {
    const mock = buildMockMatchHub(matchRow.team1_name, matchRow.team2_name)
    return {
      hub: {
        consensus: mock.consensus,
        commonScores: mock.commonScores,
        friends: mock.friends,
        myPredictions: mock.myPredictions,
        myPickPoints: 5,
        writablePools: mock.writablePools,
        competitionPools: mock.competitionPools,
        poolDistributions: [],
        team1Form: mock.team1Form,
        team2Form: mock.team2Form,
        headToHead: mock.headToHead,
        adjacent: { prev: null, next: null },
      },
      error: null,
    }
  }

  const postLock = isMatchLocked(matchRow.locked_at ?? null)

  try {
    const [
      competitionPools,
      myPredictions,
      team1Form,
      team2Form,
      headToHead,
      adjacent,
      consensus,
      commonScores,
      friends,
    ] = await Promise.all([
      fetchMatchCompetitionPools(supabase, userId, matchRow.event_id),
      userId
        ? fetchMyMatchPredictions(supabase, matchId)
        : Promise.resolve(null),
      fetchTeamForm(supabase, matchRow.team1_name, 5),
      fetchTeamForm(supabase, matchRow.team2_name, 5),
      fetchHeadToHead(
        supabase,
        matchRow.team1_name,
        matchRow.team2_name,
        5,
      ),
      fetchAdjacentEventMatches(
        supabase,
        matchRow.event_id,
        matchId,
        matchRow.kickoff_at,
      ),
      postLock
        ? fetchMatchConsensus(supabase, matchId)
        : Promise.resolve(null),
      postLock
        ? fetchMatchCommonScores(supabase, matchId, 3)
        : Promise.resolve([]),
      postLock && userId
        ? fetchFriendsMatchPredictions(supabase, matchId)
        : Promise.resolve([]),
    ])

    const writablePools = writableScorePoolsFromCompetition(competitionPools)
    const memberIds = writablePools.map((pool) => pool.memberId)

    const [myPickPoints, poolDistributions] = await Promise.all([
      userId && memberIds.length > 0
        ? fetchMyMatchPickPoints(supabase, matchId, memberIds)
        : Promise.resolve(null),
      postLock
        ? loadPoolDistributions(matchRow, competitionPools)
        : Promise.resolve([]),
    ])

    return {
      hub: {
        consensus,
        commonScores,
        friends,
        myPredictions,
        myPickPoints,
        writablePools,
        competitionPools,
        poolDistributions,
        team1Form,
        team2Form,
        headToHead,
        adjacent,
      },
      error: null,
    }
  } catch (err) {
    return {
      hub: EMPTY_HUB,
      error:
        err instanceof Error ? err.message : 'Failed to load match details',
    }
  }
}

export function GlobalMatchDetailPage({ matchId }: { matchId: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [match, setMatch] = useState<MatchRowWithEvent | null>(null)
  const [eventInfo, setEventInfo] = useState<MatchEventInfo | null>(null)
  const [hub, setHub] = useState<HubBundle>(EMPTY_HUB)
  const [team1Players, setTeam1Players] = useState<TeamRosterPlayer[]>([])
  const [team2Players, setTeam2Players] = useState<TeamRosterPlayer[]>([])
  const [rostersLoading, setRostersLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const viewedMatchIdRef = useRef<string | null>(null)

  const loadMatch = useCallback(
    async (
      showLoading: boolean,
      options?: { reloadRosters?: boolean; reloadHub?: boolean },
    ) => {
      const reloadRosters = options?.reloadRosters ?? true
      const reloadHub = options?.reloadHub ?? true
      if (showLoading) setLoading(true)
      setLoadError(null)

      const { data, error } = await supabase
        .from('matches')
        .select(MATCH_COLUMNS)
        .eq('id', matchId)
        .maybeSingle()

      if (error) {
        console.error('Failed to load match:', error.message)
        setLoadError(error.message)
        setNotFound(false)
        setMatch(null)
        setEventInfo(null)
        setHub(EMPTY_HUB)
        setTeam1Players([])
        setTeam2Players([])
        setLoading(false)
        return
      }

      if (!data) {
        setNotFound(true)
        setLoadError(null)
        setMatch(null)
        setEventInfo(null)
        setHub(EMPTY_HUB)
        setTeam1Players([])
        setTeam2Players([])
        setLoading(false)
        return
      }

      const matchRow = data as MatchRowWithEvent
      setNotFound(false)
      setMatch(matchRow)

      const event = await fetchMatchEventInfo(supabase, matchRow.event_id)
      setEventInfo(event)

      if (reloadHub) {
        const { hub: nextHub, error: hubError } = await loadHubBundle(
          matchId,
          matchRow,
          userId,
        )
        setHub(nextHub)
        if (hubError) setLoadError(hubError)
      }

      setLoading(false)

      if (!reloadRosters) return

      setRostersLoading(true)
      const [homeRoster, awayRoster] = await Promise.all([
        fetchRosterForTeamLogo(supabase, matchRow.team1_logo),
        fetchRosterForTeamLogo(supabase, matchRow.team2_logo),
      ])
      setTeam1Players(homeRoster.players)
      setTeam2Players(awayRoster.players)
      setRostersLoading(false)
    },
    [matchId, userId],
  )

  useEffect(() => {
    void loadMatch(true)
  }, [loadMatch])

  const phase = useMemo(
    () => (match ? deriveGlobalMatchPhase(match) : null),
    [match],
  )

  useEffect(() => {
    if (!match || phase !== 'live') return

    const interval = window.setInterval(() => {
      void loadMatch(false, { reloadRosters: false, reloadHub: false })
    }, LIVE_REFETCH_MS)

    return () => window.clearInterval(interval)
  }, [match, phase, loadMatch])

  useEffect(() => {
    if (!match || !phase) return
    if (viewedMatchIdRef.current === matchId) return
    viewedMatchIdRef.current = matchId
    capturePostHog('match_page_viewed', {
      match_id: matchId,
      phase,
      event_id: match.event_id ?? null,
      post_lock: isMatchLocked(match.locked_at ?? null),
    })
  }, [match, phase, matchId])

  const reloadPredictions = useCallback(async () => {
    if (!match || !userId) return
    const postLock = isMatchLocked(match.locked_at ?? null)
    const [myPredictions, competitionPools, consensus, commonScores, friends] =
      await Promise.all([
        fetchMyMatchPredictions(supabase, matchId),
        fetchMatchCompetitionPools(supabase, userId, match.event_id),
        postLock
          ? fetchMatchConsensus(supabase, matchId)
          : Promise.resolve(null),
        postLock
          ? fetchMatchCommonScores(supabase, matchId, 3)
          : Promise.resolve([]),
        postLock
          ? fetchFriendsMatchPredictions(supabase, matchId)
          : Promise.resolve([]),
      ])
    const writablePools = writableScorePoolsFromCompetition(competitionPools)
    const myPickPoints = await fetchMyMatchPickPoints(
      supabase,
      matchId,
      writablePools.map((pool) => pool.memberId),
    )
    const poolDistributions = postLock
      ? await loadPoolDistributions(match, competitionPools)
      : []

    setHub((prev) => ({
      ...prev,
      myPredictions,
      competitionPools,
      writablePools,
      consensus,
      commonScores,
      friends,
      myPickPoints,
      poolDistributions,
    }))
  }, [match, matchId, userId])

  if (loading) {
    return <GlobalMatchPageSkeleton />
  }

  if (loadError && !match) {
    return (
      <div
        className={cn(
          'flex min-h-screen items-center justify-center bg-app-background px-4',
          MOBILE_BOTTOM_NAV_PAD_CLASS,
        )}
      >
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">
            Couldn&apos;t load this match
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <Button
            type="button"
            className="mt-6"
            onClick={() => void loadMatch(true)}
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (notFound || !match || !phase) {
    return (
      <div
        className={cn(
          'flex min-h-screen items-center justify-center bg-app-background px-4',
          MOBILE_BOTTOM_NAV_PAD_CLASS,
        )}
      >
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Match not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This match may not exist or may have been removed.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <GlobalMatchDetailView
      match={toGlobalMatchDisplay(match)}
      matchId={matchId}
      phase={phase}
      eventInfo={eventInfo}
      isLoggedIn={Boolean(userId)}
      consensus={hub.consensus}
      commonScores={hub.commonScores}
      friends={hub.friends}
      myPredictions={hub.myPredictions}
      myPickPoints={hub.myPickPoints}
      writablePools={hub.writablePools}
      competitionPools={hub.competitionPools}
      poolDistributions={hub.poolDistributions}
      team1Form={hub.team1Form}
      team2Form={hub.team2Form}
      headToHead={hub.headToHead}
      adjacent={hub.adjacent}
      team1Players={team1Players}
      team2Players={team2Players}
      rostersLoading={rostersLoading}
      hubError={loadError}
      onRetryHub={() => void loadMatch(true)}
      onPredictionSaved={() => void reloadPredictions()}
    />
  )
}
