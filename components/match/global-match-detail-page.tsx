'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import {
  GlobalMatchDetailView,
  type GlobalMatchDisplay,
} from '@/components/match/global-match-detail-view'
import type { ClassicMatchRow } from '@/src/lib/merge-classic-match-predictions'
import { deriveGlobalMatchPhase } from '@/src/lib/global-match-phase'
import {
  buildMockMatchHub,
  fetchHeadToHead,
  fetchMatchCommonScores,
  fetchMatchCompetitionPools,
  fetchMatchConsensus,
  fetchMatchEventInfo,
  fetchTeamForm,
  USE_MOCK_HUB,
  writableScorePoolsFromCompetition,
  type HeadToHeadData,
  type MatchCommonScore,
  type MatchConsensus,
  type MatchEventInfo,
  type MatchRelatedPool,
  type TeamFormEntry,
} from '@/src/lib/match-hub-data'
import {
  fetchMyMatchPredictions,
  type MyMatchPredictions,
} from '@/src/lib/my-match-predictions'
import {
  fetchRosterForTeamLogo,
  type TeamRosterPlayer,
} from '@/src/lib/team-roster'
import type { WritableScorePool } from '@/components/match/match-hub-panels'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { useAuth } from '@/src/lib/auth-context'
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
  myPredictions: MyMatchPredictions | null
  writablePools: WritableScorePool[]
  competitionPools: MatchRelatedPool[]
  team1Form: TeamFormEntry[]
  team2Form: TeamFormEntry[]
  headToHead: HeadToHeadData | null
}

const EMPTY_HUB: HubBundle = {
  consensus: null,
  commonScores: [],
  myPredictions: null,
  writablePools: [],
  competitionPools: [],
  team1Form: [],
  team2Form: [],
  headToHead: null,
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

async function loadHubBundle(
  matchId: string,
  matchRow: MatchRowWithEvent,
  userId: string | null,
): Promise<HubBundle> {
  // TEMPORARY — remove after preview (USE_MOCK_HUB in match-hub-data.ts).
  if (USE_MOCK_HUB) {
    const mock = buildMockMatchHub(matchRow.team1_name, matchRow.team2_name)
    return {
      consensus: mock.consensus,
      commonScores: mock.commonScores,
      myPredictions: mock.myPredictions,
      writablePools: mock.writablePools,
      competitionPools: mock.competitionPools,
      team1Form: mock.team1Form,
      team2Form: mock.team2Form,
      headToHead: mock.headToHead,
    }
  }

  const [
    consensus,
    commonScores,
    myPredictions,
    competitionPools,
    team1Form,
    team2Form,
    headToHead,
  ] = await Promise.all([
    fetchMatchConsensus(supabase, matchId),
    fetchMatchCommonScores(supabase, matchId, 3),
    userId
      ? fetchMyMatchPredictions(supabase, matchId)
      : Promise.resolve(null),
    fetchMatchCompetitionPools(supabase, userId, matchRow.event_id),
    fetchTeamForm(supabase, matchRow.team1_name, 5),
    fetchTeamForm(supabase, matchRow.team2_name, 5),
    fetchHeadToHead(supabase, matchRow.team1_name, matchRow.team2_name, 5),
  ])

  return {
    consensus,
    commonScores,
    myPredictions,
    writablePools: writableScorePoolsFromCompetition(competitionPools),
    competitionPools,
    team1Form,
    team2Form,
    headToHead,
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

  const loadMatch = useCallback(
    async (
      showLoading: boolean,
      options?: { reloadRosters?: boolean; reloadHub?: boolean },
    ) => {
      const reloadRosters = options?.reloadRosters ?? true
      const reloadHub = options?.reloadHub ?? true
      if (showLoading) setLoading(true)

      const { data, error } = await supabase
        .from('matches')
        .select(MATCH_COLUMNS)
        .eq('id', matchId)
        .maybeSingle()

      if (error) {
        console.error('Failed to load match:', error.message)
      }

      if (!data) {
        setNotFound(true)
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
        const nextHub = await loadHubBundle(matchId, matchRow, userId)
        setHub(nextHub)
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

  const reloadPredictions = useCallback(async () => {
    if (!match || !userId) return
    const [myPredictions, competitionPools, consensus, commonScores] =
      await Promise.all([
        fetchMyMatchPredictions(supabase, matchId),
        fetchMatchCompetitionPools(supabase, userId, match.event_id),
        fetchMatchConsensus(supabase, matchId),
        fetchMatchCommonScores(supabase, matchId, 3),
      ])
    setHub((prev) => ({
      ...prev,
      myPredictions,
      competitionPools,
      writablePools: writableScorePoolsFromCompetition(competitionPools),
      consensus,
      commonScores,
    }))
  }, [match, matchId, userId])

  if (loading) {
    return <GlobalMatchPageSkeleton />
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
      myPredictions={hub.myPredictions}
      writablePools={hub.writablePools}
      competitionPools={hub.competitionPools}
      team1Form={hub.team1Form}
      team2Form={hub.team2Form}
      headToHead={hub.headToHead}
      team1Players={team1Players}
      team2Players={team2Players}
      rostersLoading={rostersLoading}
      onPredictionSaved={() => void reloadPredictions()}
    />
  )
}
