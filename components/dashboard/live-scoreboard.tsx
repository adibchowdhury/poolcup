'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'
import {
  type FeaturedMatch,
  type FeaturedMatchMode,
  FEATURED_COMPETITION_LABEL,
  fetchFeaturedMatch,
  formatFeaturedKickoffLocal,
  formatFeaturedMatchRoundLabel,
  formatFeaturedMatchStatusLabel,
} from '@/src/lib/featured-match'
import { supabase } from '@/src/lib/supabase'
import {
  DashboardGlassBackdrops,
  dashboardGlassSurfaceClass,
} from '@/components/dashboard/dashboard-glass-surface'

const REFETCH_INTERVAL_MS = 30_000
const COUNTDOWN_TICK_MS = 1000

function ScoreboardCardShell({
  matchHref,
  className,
  ariaLabel,
  children,
}: {
  matchHref?: string | null
  className?: string
  ariaLabel: string
  children: ReactNode
}) {
  if (matchHref) {
    return (
      <Link
        href={matchHref}
        className="block rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`${ariaLabel}. View match details`}
      >
        <article className={cn(className, 'transition-colors hover:border-primary/35')}>
          {children}
        </article>
      </Link>
    )
  }

  return (
    <article className={className} aria-label={ariaLabel}>
      {children}
    </article>
  )
}

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

function formatMatchClockSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${padCountdownUnit(minutes)}:${padCountdownUnit(seconds)}`
}

function computeLiveMatchClockDisplay(
  kickoffAt: string,
  statusShort: string | null,
  nowMs: number,
): string | null {
  const status = (statusShort ?? '').trim().toUpperCase()
  if (!status) return null

  if (status === 'HT') return 'Halftime'
  if (status === 'P') return 'Penalties'

  const kickoffMs = new Date(kickoffAt).getTime()
  const elapsedSeconds = (nowMs - kickoffMs) / 1000

  if (status === '1H') {
    return formatMatchClockSeconds(elapsedSeconds)
  }

  if (status === '2H') {
    const secondHalfElapsedSeconds = elapsedSeconds - 60 * 60
    return formatMatchClockSeconds(45 * 60 + secondHalfElapsedSeconds)
  }

  if (status === 'ET') {
    const extraTimeElapsedSeconds = elapsedSeconds - 120 * 60
    return formatMatchClockSeconds(90 * 60 + extraTimeElapsedSeconds)
  }

  return null
}

export function useLiveMatchClock(
  match: Pick<FeaturedMatch, 'kickoff_at' | 'status_short'>,
): string | null {
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

  if (!mounted) return null

  return computeLiveMatchClockDisplay(
    match.kickoff_at,
    match.status_short,
    nowMs,
  )
}

export function useKickoffCountdown(kickoffAt: string) {
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

export function FeaturedMatchCountdownDisplay({
  mounted,
  isKickingOff,
  label,
  compact = false,
}: {
  mounted: boolean
  isKickingOff: boolean
  label: string | null
  compact?: boolean
}) {
  if (!mounted) {
    return (
      <span
        className={cn(
          'font-mono font-bold tabular-nums text-[#ffb300]',
          compact
            ? 'text-sm'
            : 'text-xl sm:text-2xl lg:text-3xl',
        )}
        aria-hidden
      >
        {compact ? '—:——' : '—:——:——'}
      </span>
    )
  }

  if (isKickingOff) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-display font-bold uppercase tracking-wide text-primary animate-pulse',
          compact ? 'text-[11px]' : 'text-xl sm:text-2xl lg:text-3xl',
        )}
        suppressHydrationWarning
      >
        <span className="stage-live-dot h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
        Kicking off
      </span>
    )
  }

  return (
    <span
      className={cn(
        'font-mono font-bold leading-none tabular-nums text-[#ffb300]',
        compact ? 'text-sm' : 'text-xl sm:text-2xl lg:text-3xl',
      )}
      suppressHydrationWarning
    >
      {label}
    </span>
  )
}

export function LiveScoreboardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div
        className={cn(
          dashboardGlassSurfaceClass('xl', 'compact'),
          'animate-pulse px-3 py-3',
        )}
        aria-busy="true"
        aria-label="Loading live scoreboard"
      >
        <DashboardGlassBackdrops variant="compact" />
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded bg-muted" />
          <div className="h-3.5 flex-1 rounded bg-muted" />
          <div className="h-6 w-11 shrink-0 rounded bg-muted" />
          <div className="h-3.5 flex-1 rounded bg-muted" />
          <div className="h-7 w-7 rounded bg-muted" />
          <div className="h-9 w-14 shrink-0 rounded bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        dashboardGlassSurfaceClass('3xl'),
        'animate-pulse p-3 sm:p-4',
      )}
      aria-busy="true"
      aria-label="Loading live scoreboard"
    >
      <DashboardGlassBackdrops variant="full" />
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
  logoUrl,
}: {
  name: string
  dbFlag: string | null
  logoUrl?: string | null
}) {
  return (
    <div className="mx-auto flex w-max min-w-0 max-w-full flex-col items-center justify-center gap-0 sm:mx-0 sm:w-full sm:max-w-none sm:flex-1 sm:gap-1">
      <TeamFlagImage
        countryName={name}
        dbFlag={dbFlag}
        logoUrl={logoUrl}
        imgClassName="h-[7.3125rem] w-[7.3125rem] shrink-0 object-contain sm:h-[6.5rem] sm:w-full sm:max-w-[9.5rem]"
        emojiClassName="text-8xl sm:text-7xl"
      />
      <span className="-mt-0.5 line-clamp-2 max-w-full text-center text-lg font-bold leading-tight text-foreground sm:mt-0 sm:w-full sm:text-xl">
        {name}
      </span>
    </div>
  )
}

function CompactScoreboardTeam({
  name,
  dbFlag,
  logoUrl,
  align,
}: {
  name: string
  dbFlag: string | null
  logoUrl?: string | null
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
        logoUrl={logoUrl}
        imgClassName="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8"
        emojiClassName="text-lg sm:text-xl"
      />
      <span className="truncate text-xs font-semibold leading-tight text-foreground sm:text-sm">
        {name}
      </span>
    </div>
  )
}

function CompactLiveScoreboardCard({
  match,
  mode,
  matchHref,
}: {
  match: FeaturedMatch
  mode: FeaturedMatchMode
  matchHref?: string | null
}) {
  const isLive = mode === 'live'
  const isUpcoming = mode === 'upcoming'
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
    <ScoreboardCardShell
      matchHref={matchHref}
      ariaLabel={`${match.team1_name} vs ${match.team2_name}`}
      className={cn(
        dashboardGlassSurfaceClass('xl', 'compact'),
        'px-3 py-2.5 sm:px-4 sm:py-3',
      )}
    >
      <DashboardGlassBackdrops variant="compact" />
      <div className="relative flex flex-col gap-1.5">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <CompactScoreboardTeam
            name={match.team1_name}
            dbFlag={match.team1_flag}
            logoUrl={match.team1_logo}
            align="left"
          />

          <div className="flex shrink-0 flex-col items-center justify-center px-0.5 sm:px-1">
            {isLive || mode === 'final' ? (
              <p className="font-display text-lg leading-none tracking-wide text-foreground tabular-nums sm:text-xl">
                <span className="text-primary">{score1}</span>
                <span className="mx-0.5 text-muted-foreground/80">–</span>
                <span className="text-primary">{score2}</span>
              </p>
            ) : (
              <>
                <span className="font-display text-sm uppercase tracking-wider text-muted-foreground">
                  vs
                </span>
                {isUpcoming ? (
                  <FeaturedMatchCountdownDisplay compact {...kickoffCountdown} />
                ) : null}
              </>
            )}
          </div>

          <CompactScoreboardTeam
            name={match.team2_name}
            dbFlag={match.team2_flag}
            logoUrl={match.team2_logo}
            align="right"
          />

          {isLive || isUpcoming ? (
            <div className="ml-0.5 shrink-0 border-l border-white/10 pl-2.5 sm:pl-3">
              {isLive ? (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
                    <span
                      className="stage-live-dot h-1.5 w-1.5 shrink-0 rounded-full"
                      aria-hidden
                    />
                    Live
                  </span>
                  <span
                    className="text-[11px] font-medium tabular-nums leading-none text-primary sm:text-xs"
                    suppressHydrationWarning
                  >
                    {liveTopRightLabel}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wide text-primary sm:text-xs">
                  Up next
                </span>
              )}
            </div>
          ) : null}
        </div>

        <time
          dateTime={match.kickoff_at}
          className="block w-full text-center text-[10px] font-medium leading-tight text-muted-foreground sm:text-[11px]"
          suppressHydrationWarning
        >
          {formatFeaturedKickoffLocal(match.kickoff_at)}
        </time>
      </div>
    </ScoreboardCardShell>
  )
}

export function LiveScoreboardCard({
  match,
  mode,
  compact = false,
  matchHref,
}: {
  match: FeaturedMatch
  mode: FeaturedMatchMode
  compact?: boolean
  matchHref?: string | null
}) {
  if (compact) {
    return (
      <CompactLiveScoreboardCard
        match={match}
        mode={mode}
        matchHref={matchHref}
      />
    )
  }

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
    <ScoreboardCardShell
      matchHref={matchHref}
      ariaLabel={`${match.team1_name} vs ${match.team2_name}`}
      className={cn(dashboardGlassSurfaceClass('3xl'), 'px-2 py-1 sm:p-4')}
    >
      <DashboardGlassBackdrops variant="full" />
      <p className="mb-0 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:mb-1 sm:text-left sm:text-[10px] sm:font-medium sm:text-muted-foreground/80">
        {FEATURED_COMPETITION_LABEL}
      </p>

      <div className="mb-0 flex flex-col gap-0 sm:hidden">
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
              <span className="stage-live-dot h-2 w-2 shrink-0 rounded-full" aria-hidden />
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
            logoUrl={match.team1_logo}
          />

          <div
            className={cn(
              'flex shrink-0 flex-col items-center justify-center',
              isUpcoming ? 'px-1' : 'w-[4.5rem]',
              isLive && 'h-[7.3125rem]',
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
          </div>

          <ScoreboardTeam
            name={match.team2_name}
            dbFlag={match.team2_flag}
            logoUrl={match.team2_logo}
          />
        </div>
      </div>

      <div className="mb-2 hidden grid-cols-3 items-center gap-1 sm:grid">
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
          ) : isLive ? (
            <span
              className="text-xs font-medium tabular-nums tracking-wide text-primary"
              suppressHydrationWarning
            >
              {liveTopRightLabel}
            </span>
          ) : (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      <div className="hidden items-center gap-0 sm:flex">
        <ScoreboardTeam
          name={match.team1_name}
          dbFlag={match.team1_flag}
          logoUrl={match.team1_logo}
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
          logoUrl={match.team2_logo}
        />
      </div>

      {isUpcoming ? (
        <div className="mt-1.5 flex flex-col items-center gap-1 px-1 text-center sm:hidden">
          <FeaturedMatchCountdownDisplay {...kickoffCountdown} />
          <time
            dateTime={match.kickoff_at}
            className="text-xs text-muted-foreground"
          >
            {formatFeaturedKickoffLocal(match.kickoff_at)}
          </time>
        </div>
      ) : null}
    </ScoreboardCardShell>
  )
}

export function useFeaturedMatch(eventId?: string | null) {
  const [match, setMatch] = useState<FeaturedMatch | null>(null)
  const [mode, setMode] = useState<FeaturedMatchMode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadFeaturedMatch = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoading(true)
      setError(null)

      try {
        const result = await fetchFeaturedMatch(supabase, { eventId })
        setMatch(result.match)
        setMode(result.mode)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load match')
        setMatch(null)
        setMode(null)
      } finally {
        setLoading(false)
      }
    },
    [eventId],
  )

  useEffect(() => {
    void loadFeaturedMatch(true)
  }, [loadFeaturedMatch])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadFeaturedMatch(false)
    }, REFETCH_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [loadFeaturedMatch])

  return { match, mode, loading, error }
}

export function LiveScoreboard({
  compact = false,
  eventId = null,
}: {
  compact?: boolean
  /** Scope featured match to a pool's sporting event (pool chat). */
  eventId?: string | null
} = {}) {
  const { match, mode, loading, error } = useFeaturedMatch(eventId)

  const matchHref = match?.id ? `/match/${match.id}` : null

  if (loading) {
    return <LiveScoreboardSkeleton compact={compact} />
  }

  if (error || !match || !mode) {
    return null
  }

  return (
    <LiveScoreboardCard
      match={match}
      mode={mode}
      compact={compact}
      matchHref={matchHref}
    />
  )
}
