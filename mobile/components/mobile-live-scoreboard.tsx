'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  FEATURED_COMPETITION_LABEL,
  fetchFeaturedMatch,
  formatFeaturedMatchRoundLabel,
  formatFeaturedMatchStatusLabel,
  type FeaturedMatch,
  type FeaturedMatchMode,
} from '@/src/lib/featured-match'
import { useLiveMatchClock } from '../lib/live-match-clock'
import { supabase } from '../lib/supabase-mobile'
import {
  SCOREBOARD_CARD_SHELL_CLASS,
  SCOREBOARD_CARD_SLOT_CLASS,
  ScoreboardCardShell,
  ScoreboardCompetitionLabel,
  ScoreboardFlagTeam,
  ScoreboardHeaderRow,
  ScoreboardKickoffTopRight,
  ScoreboardLiveTopRight,
  ScoreboardMatchupGrid,
  ScoreboardRoundPill,
  ScoreboardScoreCenter,
  ScoreboardStatusTopRight,
  ScoreboardVsCenter,
} from './mobile-scoreboard-card-shared'

const REFETCH_INTERVAL_MS = 30_000

export { SCOREBOARD_CARD_SLOT_CLASS }

export function ScoreboardSkeleton() {
  return (
    <div
      className={cn(SCOREBOARD_CARD_SHELL_CLASS, 'h-full animate-pulse')}
      aria-busy="true"
      aria-label="Loading live scoreboard"
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="mb-1.5 h-4 w-32 shrink-0 self-center rounded bg-muted" />
        <div className="mb-1.5 grid grid-cols-2 gap-2">
          <div className="h-6 w-20 rounded bg-muted" />
          <div className="ml-auto h-6 w-24 rounded bg-muted" />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center justify-items-center gap-0">
          <div className="flex flex-col items-center gap-0">
            <div className="flex h-[7.3125rem] w-[7.3125rem] items-center justify-center">
              <div className="aspect-[3/2] w-[7.3125rem] rounded bg-muted" />
            </div>
            <div className="mt-0.5 h-5 w-24 rounded bg-muted" />
          </div>
          <div className="h-10 w-14 shrink-0 rounded bg-muted" />
          <div className="flex flex-col items-center gap-0">
            <div className="flex h-[7.3125rem] w-[7.3125rem] items-center justify-center">
              <div className="aspect-[3/2] w-[7.3125rem] rounded bg-muted" />
            </div>
            <div className="mt-0.5 h-5 w-24 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function LiveScoreboardCard({
  match,
  mode,
  onOpenMatch,
}: {
  match: FeaturedMatch
  mode: FeaturedMatchMode
  onOpenMatch: (matchId: string) => void
}) {
  const roundLabel = formatFeaturedMatchRoundLabel(match.round, match.group_name)
  const groupPillLabel =
    match.round === 'group' && match.group_name
      ? `Group ${match.group_name}`
      : roundLabel
  const isLive = mode === 'live'
  const isUpcoming = mode === 'upcoming'
  const isFinal = mode === 'final' || match.is_final
  const statusLabel = formatFeaturedMatchStatusLabel(
    match.status_short,
    match.elapsed_minute,
    isFinal,
  )

  const score1 = match.result_team1 ?? 0
  const score2 = match.result_team2 ?? 0
  const liveClockLabel = useLiveMatchClock(match)

  const topRight = isLive ? (
    <ScoreboardLiveTopRight clockLabel={liveClockLabel} />
  ) : isUpcoming ? (
    <ScoreboardKickoffTopRight kickoffAt={match.kickoff_at} />
  ) : (
    <ScoreboardStatusTopRight label={statusLabel} />
  )

  const center =
    isLive || isFinal ? (
      <ScoreboardScoreCenter score1={score1} score2={score2} />
    ) : (
      <ScoreboardVsCenter />
    )

  return (
    <button
      type="button"
      onClick={() => onOpenMatch(match.id)}
      className="block h-full w-full overflow-hidden rounded-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${match.team1_name} vs ${match.team2_name}. View match details`}
    >
      <ScoreboardCardShell>
        <ScoreboardCompetitionLabel label={FEATURED_COMPETITION_LABEL} />

        <div className="flex min-h-0 flex-1 flex-col gap-0.5">
          <ScoreboardHeaderRow
            leftPill={<ScoreboardRoundPill label={groupPillLabel} />}
            topRight={topRight}
          />

          <ScoreboardMatchupGrid
            centerIsScore={isLive || isFinal}
            team1={
              <ScoreboardFlagTeam
                name={match.team1_name}
                dbFlag={match.team1_flag}
              />
            }
            center={center}
            team2={
              <ScoreboardFlagTeam
                name={match.team2_name}
                dbFlag={match.team2_flag}
              />
            }
          />
        </div>
      </ScoreboardCardShell>
    </button>
  )
}

export function MobileLiveScoreboard({
  onOpenMatch,
  onFeaturedMatchLoaded,
}: {
  onOpenMatch: (matchId: string) => void
  onFeaturedMatchLoaded?: (matchId: string | null) => void
}) {
  const [match, setMatch] = useState<FeaturedMatch | null>(null)
  const [mode, setMode] = useState<FeaturedMatchMode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadFeaturedMatch = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true)
    setError(null)

    try {
      const result = await fetchFeaturedMatch(supabase)
      setMatch(result.match)
      setMode(result.mode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load match')
      setMatch(null)
      setMode(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void loadFeaturedMatch(true)
  }, [loadFeaturedMatch])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadFeaturedMatch(false)
    }, REFETCH_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [loadFeaturedMatch])

  useEffect(() => {
    onFeaturedMatchLoaded?.(match?.id ?? null)
  }, [match?.id, onFeaturedMatchLoaded])

  if (loading) return <ScoreboardSkeleton />
  if (error || !match || !mode) return null

  return <LiveScoreboardCard match={match} mode={mode} onOpenMatch={onOpenMatch} />
}
