'use client'

import { useCallback, useEffect, useState } from 'react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'
import {
  type FeaturedMatch,
  type FeaturedMatchMode,
  fetchFeaturedMatch,
  formatFeaturedKickoffLocal,
  formatFeaturedMatchRoundLabel,
  formatFeaturedMatchStatusLabel,
} from '@/src/lib/featured-match'
import { supabase } from '@/src/lib/supabase'

const REFETCH_INTERVAL_MS = 60_000
const COUNTDOWN_TICK_MS = 1000

function padCountdownUnit(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatFeaturedMatchCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}d ${hours}h ${padCountdownUnit(minutes)}m ${padCountdownUnit(seconds)}s`
  }

  return `${padCountdownUnit(hours)}:${padCountdownUnit(minutes)}:${padCountdownUnit(seconds)}`
}

function useKickoffCountdown(kickoffAt: string) {
  const [mounted, setMounted] = useState(false)
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    setMounted(true)
    setNowMs(Date.now())

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, COUNTDOWN_TICK_MS)

    return () => window.clearInterval(interval)
  }, [])

  const remainingMs = mounted
    ? new Date(kickoffAt).getTime() - nowMs
    : null

  return {
    mounted,
    isKickingOff: remainingMs != null && remainingMs <= 0,
    label:
      remainingMs != null && remainingMs > 0
        ? formatFeaturedMatchCountdown(remainingMs)
        : null,
  }
}

function FeaturedMatchCountdownDisplay({
  mounted,
  isKickingOff,
  label,
}: {
  mounted: boolean
  isKickingOff: boolean
  label: string | null
}) {
  if (!mounted) {
    return (
      <span
        className="font-mono text-xl font-bold tabular-nums text-[#ffb300] sm:text-2xl lg:text-3xl"
        aria-hidden
      >
        —:——:——
      </span>
    )
  }

  if (isKickingOff) {
    return (
      <span
        className="inline-flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide text-primary animate-pulse sm:text-2xl lg:text-3xl"
        suppressHydrationWarning
      >
        <span className="stage-live-dot h-2.5 w-2.5 shrink-0 rounded-full" aria-hidden />
        Kicking off
      </span>
    )
  }

  return (
    <span
      className="font-mono text-xl font-bold leading-none tabular-nums text-[#ffb300] sm:text-2xl lg:text-3xl"
      suppressHydrationWarning
    >
      {label}
    </span>
  )
}

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
}: {
  match: FeaturedMatch
  mode: FeaturedMatchMode
}) {
  const roundLabel = formatFeaturedMatchRoundLabel(match.round, match.group_name)
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

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/15 backdrop-blur-2xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.14),inset_0_-2px_4px_0_rgba(0,0,0,0.55),inset_0_2px_6px_0_rgba(255,255,255,0.06)] p-3 sm:p-4',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent',
      )}
      aria-label={`${match.team1_name} vs ${match.team2_name}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-30"
        style={{
          background:
            'radial-gradient(80% 60% at 20% 15%, hsl(var(--primary) / 0.40), transparent 55%), radial-gradient(70% 60% at 85% 25%, rgba(255,179,0,0.16), transparent 55%), #0D1F14',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background: 'rgba(176, 224, 196, 0.05)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.022) 8%, transparent 16%)',
        }}
      />
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

        <div
          className={cn(
            'flex shrink-0 flex-col items-center justify-center',
            isUpcoming
              ? 'w-[4.5rem] sm:w-auto sm:min-w-[11rem] sm:px-2'
              : 'w-[4.5rem] sm:w-[5rem]',
          )}
        >
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
          {isUpcoming ? (
            <div className="mt-2 hidden w-full flex-col items-center gap-2 px-1 text-center sm:flex">
              <FeaturedMatchCountdownDisplay {...kickoffCountdown} />
              <time
                dateTime={match.kickoff_at}
                className="text-xs text-muted-foreground"
              >
                {formatFeaturedKickoffLocal(match.kickoff_at)}
              </time>
            </div>
          ) : null}
        </div>

        <ScoreboardTeam
          name={match.team2_name}
          dbFlag={match.team2_flag}
        />
      </div>

      {isUpcoming ? (
        <div className="mt-3 flex flex-col items-center gap-2 px-1 text-center sm:hidden">
          <FeaturedMatchCountdownDisplay {...kickoffCountdown} />
          <time
            dateTime={match.kickoff_at}
            className="text-xs text-muted-foreground"
          >
            {formatFeaturedKickoffLocal(match.kickoff_at)}
          </time>
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

  return <LiveScoreboardCard match={match} mode={mode} />
}
