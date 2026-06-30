'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { supabase } from '../lib/supabase-mobile'
import {
  useKickoffCountdown,
  useLiveMatchClock,
} from '../lib/live-match-clock'

const REFETCH_INTERVAL_MS = 30_000

function ScoreboardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-2xl border border-border/80 bg-card/50 px-3 py-3"
      aria-busy="true"
      aria-label="Loading live scoreboard"
    >
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded bg-muted" />
        <div className="h-3.5 flex-1 rounded bg-muted" />
        <div className="h-6 w-11 shrink-0 rounded bg-muted" />
        <div className="h-3.5 flex-1 rounded bg-muted" />
        <div className="h-7 w-7 rounded bg-muted" />
      </div>
    </div>
  )
}

function CompactTeam({
  name,
  dbFlag,
  align,
}: {
  name: string
  dbFlag: string | null
  align: 'left' | 'right'
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      <TeamFlagImage
        countryName={name}
        dbFlag={dbFlag}
        imgClassName="h-7 w-7 shrink-0 object-contain"
        emojiClassName="text-lg"
      />
      <span className="truncate text-xs font-semibold leading-tight text-foreground">
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
  const isLive = mode === 'live'
  const isUpcoming = mode === 'upcoming'
  const score1 = match.result_team1 ?? 0
  const score2 = match.result_team2 ?? 0
  const kickoffCountdown = useKickoffCountdown(match.kickoff_at)
  const liveClockLabel = useLiveMatchClock(match)
  const statusLabel = formatFeaturedMatchStatusLabel(
    match.status_short,
    match.elapsed_minute,
    match.is_final || mode === 'final',
  )
  const liveTopRightLabel =
    liveClockLabel ??
    formatFeaturedMatchStatusLabel(
      match.status_short,
      match.elapsed_minute,
      match.is_final,
    )
  const roundLabel = formatFeaturedMatchRoundLabel(match.round, match.group_name)

  return (
    <button
      type="button"
      onClick={() => onOpenMatch(match.id)}
      className={cn(
        'w-full overflow-hidden rounded-2xl border border-primary/20 text-left',
        'bg-gradient-to-br from-card via-card to-primary/[0.06]',
        'px-3 py-3 shadow-[0_2px_14px_rgba(0,0,0,0.32)] transition-colors',
        'hover:border-primary/35 active:bg-card/80',
      )}
      aria-label={`${match.team1_name} vs ${match.team2_name}. View match details`}
    >
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {FEATURED_COMPETITION_LABEL}
      </p>
      <p className="mb-2 text-center text-xs font-medium text-primary">
        {roundLabel}
      </p>

      <div className="flex items-center gap-2">
        <CompactTeam
          name={match.team1_name}
          dbFlag={match.team1_flag}
          align="left"
        />

        <div className="flex shrink-0 flex-col items-center justify-center px-0.5">
          {isLive || mode === 'final' ? (
            <p className="font-display text-lg leading-none tracking-wide text-foreground tabular-nums">
              <span className="text-primary">{score1}</span>
              <span className="mx-0.5 text-muted-foreground/80">–</span>
              <span className="text-primary">{score2}</span>
            </p>
          ) : (
            <>
              <span className="font-display text-sm uppercase tracking-wider text-muted-foreground">
                vs
              </span>
              {isUpcoming && kickoffCountdown.mounted && kickoffCountdown.label ? (
                <span
                  className="mt-1 font-mono text-sm font-bold tabular-nums text-[#ffb300]"
                  suppressHydrationWarning
                >
                  {kickoffCountdown.label}
                </span>
              ) : null}
            </>
          )}
        </div>

        <CompactTeam
          name={match.team2_name}
          dbFlag={match.team2_flag}
          align="right"
        />

        <div className="ml-0.5 shrink-0 border-l border-white/10 pl-2.5">
          {isLive ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
              <span
                className="text-[11px] font-medium tabular-nums leading-none text-primary"
                suppressHydrationWarning
              >
                {liveTopRightLabel}
              </span>
            </div>
          ) : isUpcoming ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
              Up next
            </span>
          ) : (
            <span className="max-w-[4.5rem] text-right text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      {isUpcoming ? (
        <time
          dateTime={match.kickoff_at}
          className="mt-2 block text-center text-xs text-muted-foreground"
          suppressHydrationWarning
        >
          {formatFeaturedKickoffLocal(match.kickoff_at)}
        </time>
      ) : null}
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
