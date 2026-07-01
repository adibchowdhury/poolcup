'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DashboardGlassBackdrops,
  dashboardGlassSurfaceClass,
} from '@/components/dashboard/dashboard-glass-surface'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'
import {
  FEATURED_COMPETITION_LABEL,
  fetchFeaturedMatch,
  formatFeaturedKickoffLocal,
  formatFeaturedMatchRoundLabel,
  formatFeaturedMatchStatusLabel,
  type FeaturedMatch,
  type FeaturedMatchMode,
} from '@/src/lib/featured-match'
import {
  FeaturedMatchCountdownDisplay,
  useKickoffCountdown,
  useLiveMatchClock,
} from '../lib/live-match-clock'
import { supabase } from '../lib/supabase-mobile'

const REFETCH_INTERVAL_MS = 30_000

function ScoreboardSkeleton() {
  return (
    <div
      className={cn(
        dashboardGlassSurfaceClass('3xl'),
        'animate-pulse p-3',
      )}
      aria-busy="true"
      aria-label="Loading live scoreboard"
    >
      <DashboardGlassBackdrops variant="full" />
      <div className="mb-2 h-5 w-24 rounded bg-muted" />
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="h-20 w-full max-w-[7rem] rounded bg-muted" />
          <div className="h-5 w-24 rounded bg-muted" />
        </div>
        <div className="h-10 w-14 shrink-0 rounded bg-muted" />
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="h-20 w-full max-w-[7rem] rounded bg-muted" />
          <div className="h-5 w-24 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}

function ScoreboardTeam({
  name,
  dbFlag,
}: {
  name: string
  dbFlag: string | null
}) {
  return (
    <div className="mx-auto flex w-max min-w-0 max-w-full flex-col items-center justify-center gap-0">
      <TeamFlagImage
        countryName={name}
        dbFlag={dbFlag}
        imgClassName="h-[7.3125rem] w-[7.3125rem] shrink-0 object-contain"
        emojiClassName="text-8xl"
      />
      <span className="-mt-0.5 line-clamp-2 max-w-full text-center text-lg font-bold leading-tight text-foreground">
        {name}
      </span>
    </div>
  )
}

function LiveScoreboardCard({
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
  const mobileStageSecondaryLabel =
    match.round === 'group' ? 'Group Stage' : roundLabel
  const isLive = mode === 'live'
  const isUpcoming = mode === 'upcoming'
  const statusLabel = formatFeaturedMatchStatusLabel(
    match.status_short,
    match.elapsed_minute,
    match.is_final || mode === 'final',
  )

  const score1 = match.result_team1 ?? 0
  const score2 = match.result_team2 ?? 0
  const kickoffCountdown = useKickoffCountdown(match.kickoff_at)
  const liveClockLabel = useLiveMatchClock(match)
  const liveTopRightLabel =
    liveClockLabel ??
    formatFeaturedMatchStatusLabel(
      match.status_short,
      match.elapsed_minute,
      match.is_final,
    )

  return (
    <button
      type="button"
      onClick={() => onOpenMatch(match.id)}
      className="block w-full overflow-hidden rounded-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${match.team1_name} vs ${match.team2_name}. View match details`}
    >
      <article
        className={cn(
          dashboardGlassSurfaceClass('3xl'),
          'px-2 py-1 transition-colors hover:border-primary/35',
        )}
      >
        <DashboardGlassBackdrops variant="full" />

        <p className="mb-0 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {FEATURED_COMPETITION_LABEL}
        </p>

        <div className="mb-0 flex flex-col gap-0">
          <div className="grid grid-cols-2 items-center gap-0.5">
            <span className="justify-self-start rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {groupPillLabel}
            </span>

            <div className="justify-self-end">
              {isUpcoming ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Up next
                </span>
              ) : isLive ? (
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {mobileStageSecondaryLabel}
                </span>
              ) : (
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {statusLabel}
                </span>
              )}
            </div>
          </div>

          {isLive ? (
            <div className="mt-0.5 flex flex-col items-center justify-center gap-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-red-400">
                <span
                  className="stage-live-dot h-2 w-2 shrink-0 rounded-full"
                  aria-hidden
                />
                Live Score
              </span>
              <span
                className="mt-0.5 -mb-1.5 text-xs font-medium tabular-nums tracking-wide text-primary"
                suppressHydrationWarning
              >
                {liveTopRightLabel}
              </span>
            </div>
          ) : null}

          <div
            className={cn(
              'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] justify-items-center gap-0',
              isLive ? '-mt-3.5 items-start' : '-mt-0.5 items-center',
            )}
          >
            <ScoreboardTeam
              name={match.team1_name}
              dbFlag={match.team1_flag}
            />

            <div
              className={cn(
                'flex shrink-0 flex-col items-center justify-center',
                isUpcoming ? 'px-1' : 'w-[4.5rem]',
                isLive && 'h-[7.3125rem]',
              )}
            >
              {isLive || mode === 'final' ? (
                <p className="font-display text-4xl leading-none tracking-wider text-foreground tabular-nums">
                  <span className="text-primary">{score1}</span>
                  <span className="mx-1 text-muted-foreground/80">–</span>
                  <span className="text-primary">{score2}</span>
                </p>
              ) : (
                <span className="font-display text-2xl uppercase tracking-[0.2em] text-muted-foreground">
                  vs
                </span>
              )}
            </div>

            <ScoreboardTeam
              name={match.team2_name}
              dbFlag={match.team2_flag}
            />
          </div>
        </div>

        {isUpcoming ? (
          <div className="mt-1.5 flex flex-col items-center gap-1 px-1 text-center">
            <FeaturedMatchCountdownDisplay {...kickoffCountdown} />
            <time
              dateTime={match.kickoff_at}
              className="text-xs text-muted-foreground"
              suppressHydrationWarning
            >
              {formatFeaturedKickoffLocal(match.kickoff_at)}
            </time>
          </div>
        ) : null}
      </article>
    </button>
  )
}

export function MobileLiveScoreboard({
  onOpenMatch,
}: {
  onOpenMatch: (matchId: string) => void
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

  if (loading) return <ScoreboardSkeleton />
  if (error || !match || !mode) return null

  return <LiveScoreboardCard match={match} mode={mode} onOpenMatch={onOpenMatch} />
}
