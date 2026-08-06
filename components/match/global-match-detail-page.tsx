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
  fetchMatchEventInfo,
  type MatchEventInfo,
} from '@/src/lib/match-hub-data'
import {
  fetchRosterForTeamLogo,
  type TeamRosterPlayer,
} from '@/src/lib/team-roster'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { supabase } from '@/src/lib/supabase'

const MATCH_COLUMNS =
  'id, event_id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, team1_logo, team2_logo, group_name, round, result_team1, result_team2, is_final, advancing_team, status_short, elapsed_minute'

const LIVE_REFETCH_MS = 30_000

type MatchRowWithEvent = ClassicMatchRow & {
  event_id?: string | null
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
        <ShimmerBlock className="h-32 w-full rounded-2xl" />
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

export function GlobalMatchDetailPage({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<MatchRowWithEvent | null>(null)
  const [eventInfo, setEventInfo] = useState<MatchEventInfo | null>(null)
  const [team1Players, setTeam1Players] = useState<TeamRosterPlayer[]>([])
  const [team2Players, setTeam2Players] = useState<TeamRosterPlayer[]>([])
  const [rostersLoading, setRostersLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const loadMatch = useCallback(
    async (showLoading: boolean, options?: { reloadRosters?: boolean }) => {
      const reloadRosters = options?.reloadRosters ?? true
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
    [matchId],
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
      void loadMatch(false, { reloadRosters: false })
    }, LIVE_REFETCH_MS)

    return () => window.clearInterval(interval)
  }, [match, phase, loadMatch])

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
      phase={phase}
      eventInfo={eventInfo}
      team1Players={team1Players}
      team2Players={team2Players}
      rostersLoading={rostersLoading}
    />
  )
}
