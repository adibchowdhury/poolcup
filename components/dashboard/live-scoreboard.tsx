'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'
import {
  type FeaturedMatch,
  type FeaturedMatchMode,
  fetchFeaturedMatch,
  formatFeaturedCountdown,
  formatFeaturedKickoffLocal,
  formatFeaturedMatchRoundLabel,
  formatFeaturedMatchStatusLabel,
} from '@/src/lib/featured-match'
import { supabase } from '@/src/lib/supabase'

const REFETCH_INTERVAL_MS = 60_000

function LiveScoreboardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-2xl border border-border/80 bg-card/80 p-3 sm:p-4"
      aria-busy="true"
      aria-label="Loading live scoreboard"
    >
      <div className="mb-2 h-5 w-24 rounded bg-muted" />
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="h-20 w-full max-w-[7rem] rounded bg-muted sm:h-28" />
          <div className="h-5 w-24 rounded bg-muted" />
        </div>
        <div className="h-10 w-14 shrink-0 rounded bg-muted" />
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="h-20 w-full max-w-[7rem] rounded bg-muted sm:h-28" />
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
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1">
      <TeamFlagImage
        countryName={name}
        dbFlag={dbFlag}
        imgClassName="h-[4.5rem] w-full max-w-[8rem] object-contain sm:h-[6.5rem] sm:max-w-[9.5rem]"
        emojiClassName="text-6xl sm:text-7xl"
      />
      <span className="line-clamp-2 w-full text-center text-lg font-bold leading-tight text-foreground sm:text-xl">
        {name}
      </span>
    </div>
  )
}

function LiveScoreboardCard({
  match,
  mode,
  mounted,
  nowMs,
}: {
  match: FeaturedMatch
  mode: FeaturedMatchMode
  mounted: boolean
  nowMs: number
}) {
  const roundLabel = formatFeaturedMatchRoundLabel(match.round, match.group_name)
  const isLive = mode === 'live'
  const isUpcoming = mode === 'upcoming'
  const statusLabel = formatFeaturedMatchStatusLabel(
    match.status_short,
    match.elapsed_minute,
    match.is_final || mode === 'final',
  )
  const countdown =
    mounted && isUpcoming
      ? formatFeaturedCountdown(match.kickoff_at, nowMs)
      : null

  const score1 = match.result_team1 ?? 0
  const score2 = match.result_team2 ?? 0

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-[#0f1419] to-card p-3 shadow-lg sm:p-4',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/60 before:to-transparent',
      )}
      aria-label={`${match.team1_name} vs ${match.team2_name}`}
    >
      <div className="mb-2 grid grid-cols-3 items-center gap-1">
        <span className="justify-self-start rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {roundLabel}
        </span>

        {isLive ? (
          <span className="justify-self-center inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-red-400">
            <span className="stage-live-dot h-2 w-2 shrink-0 rounded-full" aria-hidden />
            Live Score
          </span>
        ) : (
          <span />
        )}

        <div className="justify-self-end">
          {isUpcoming ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              Up next
            </span>
          ) : !isLive ? (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {statusLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-0">
        <ScoreboardTeam
          name={match.team1_name}
          dbFlag={match.team1_flag}
        />

        <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center sm:w-[5rem]">
          {isLive || mode === 'final' ? (
            <p className="font-display text-4xl leading-none tracking-wider text-foreground tabular-nums sm:text-5xl">
              <span className="text-primary">{score1}</span>
              <span className="mx-1 text-muted-foreground/80 sm:mx-1.5">–</span>
              <span className="text-primary">{score2}</span>
            </p>
          ) : (
            <span className="font-display text-2xl uppercase tracking-[0.2em] text-muted-foreground sm:text-3xl">
              vs
            </span>
          )}
        </div>

        <ScoreboardTeam
          name={match.team2_name}
          dbFlag={match.team2_flag}
        />
      </div>

      {isUpcoming ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground sm:justify-start">
          <time dateTime={match.kickoff_at}>
            {formatFeaturedKickoffLocal(match.kickoff_at)}
          </time>
          {countdown ? (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {countdown}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export function LiveScoreboard() {
  const [match, setMatch] = useState<FeaturedMatch | null>(null)
  const [mode, setMode] = useState<FeaturedMatchMode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { mounted, nowMs } = useClientNow(1000)

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
    void loadFeaturedMatch(true)
  }, [loadFeaturedMatch])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadFeaturedMatch(false)
    }, REFETCH_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [loadFeaturedMatch])

  if (loading) {
    return <LiveScoreboardSkeleton />
  }

  if (error || !match || !mode) {
    return null
  }

  return (
    <LiveScoreboardCard
      match={match}
      mode={mode}
      mounted={mounted}
      nowMs={nowMs}
    />
  )
}
