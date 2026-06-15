'use client'

import { Calendar, Clock } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useClientNow } from '@/hooks/use-client-now'
import { UpcomingGamesSkeleton } from '@/components/dashboard/upcoming-games-skeleton'
import { cn } from '@/lib/utils'
import {
  countryNameToFlagSrc,
  hasFlagImage,
  resolveTeamFlagDisplay,
} from '@/src/lib/team-flags'
import { supabase } from '@/src/lib/supabase'

type UpcomingMatch = {
  id: string
  kickoff_at: string
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  group_name: string | null
  round: string
}

const ROUND_LABELS: Record<string, string> = {
  group: 'Group stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
}

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000

let cachedMatches: UpcomingMatch[] | null = null
let loadPromise: Promise<{
  matches: UpcomingMatch[] | null
  error: string | null
}> | null = null

async function fetchUpcomingMatchesFromDb(): Promise<{
  matches: UpcomingMatch[] | null
  error: string | null
}> {
  const { data, error: fetchError } = await supabase
    .from('matches')
    .select(
      'id, kickoff_at, team1_name, team2_name, team1_flag, team2_flag, group_name, round',
    )
    .gt('kickoff_at', new Date().toISOString())
    .eq('is_final', false)
    .order('kickoff_at', { ascending: true })
    .limit(15)

  if (fetchError) {
    return { matches: null, error: fetchError.message }
  }

  return { matches: (data ?? []) as UpcomingMatch[], error: null }
}

function loadUpcomingMatches() {
  if (cachedMatches !== null) {
    return Promise.resolve({ matches: cachedMatches, error: null })
  }

  if (!loadPromise) {
    loadPromise = fetchUpcomingMatchesFromDb().then((result) => {
      if (!result.error && result.matches) {
        cachedMatches = result.matches
      } else {
        loadPromise = null
      }
      return result
    })
  }

  return loadPromise
}

/** Warm cache while the user is on another dashboard tab. */
export function prefetchUpcomingMatches() {
  void loadUpcomingMatches()
}

function formatRoundLabel(round: string, groupName: string | null): string {
  if (round === 'group' && groupName) {
    return `Group ${groupName}`
  }
  return ROUND_LABELS[round] ?? round
}

const DATE_LOCALE = 'en-US'

function formatDateHeader(iso: string): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatKickoffCompact(iso: string): string {
  const kickoff = new Date(iso)
  const datePart = kickoff.toLocaleDateString(DATE_LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const timePart = kickoff.toLocaleTimeString(DATE_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${datePart} – ${timePart}`
}

function getCountdownLabel(kickoffAt: string, nowMs: number): string | null {
  const ms = new Date(kickoffAt).getTime() - nowMs
  if (ms <= 0 || ms > FORTY_EIGHT_HOURS_MS) return null

  const totalHours = Math.max(1, Math.ceil(ms / (60 * 60 * 1000)))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  if (days > 0) {
    return `Starts in ${days}d ${hours}h`
  }
  return `Starts in ${hours}h`
}

function groupMatchesByDay(matches: UpcomingMatch[]): Map<string, UpcomingMatch[]> {
  const byDay = new Map<string, UpcomingMatch[]>()
  for (const match of matches) {
    const dayKey = new Date(match.kickoff_at).toDateString()
    if (!byDay.has(dayKey)) byDay.set(dayKey, [])
    byDay.get(dayKey)!.push(match)
  }
  return byDay
}

function UpcomingGamesPageHeader() {
  return (
    <header className="mb-5 border-b border-border/50 pb-4 sm:mb-6">
      <div className="flex items-start gap-3">
        <Calendar
          className="mt-0.5 h-6 w-6 shrink-0 text-primary"
          aria-hidden
        />
        <div className="min-w-0">
          <h2 className="font-display text-3xl tracking-wide text-foreground sm:text-4xl">
            UPCOMING GAMES
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Track every upcoming World Cup fixture and see when predictions lock.
          </p>
        </div>
      </div>
    </header>
  )
}

function formatGroupAccentLabel(round: string, groupName: string | null): string {
  if (round === 'group' && groupName) {
    return `GROUP ${groupName.toUpperCase()}`
  }
  return formatRoundLabel(round, groupName).toUpperCase()
}

function TeamFlagImage({
  countryName,
  dbFlag,
  size = 'default',
}: {
  countryName: string
  dbFlag: string | null
  size?: 'default' | 'matchup'
}) {
  const flagSrc = countryNameToFlagSrc(countryName)
  const [imageFailed, setImageFailed] = useState(false)
  const fallbackLabel = resolveTeamFlagDisplay(countryName, dbFlag)
  const showFlagImage = hasFlagImage(countryName)
  const isMatchup = size === 'matchup'

  useEffect(() => {
    setImageFailed(false)
  }, [flagSrc, showFlagImage])

  if (!showFlagImage || imageFailed) {
    return (
      <span
        className={cn(
          'shrink-0 leading-none',
          isMatchup
            ? 'text-4xl sm:text-5xl md:text-[3.5rem]'
            : 'text-[1.75rem] sm:text-[2rem]',
        )}
        aria-hidden
      >
        {fallbackLabel}
      </span>
    )
  }

  return (
    <img
      key={flagSrc}
      src={flagSrc}
      alt=""
      className={cn(
        'shrink-0 object-cover',
        isMatchup
          ? 'aspect-[3/2] h-[3.75rem] w-auto sm:h-[5.5rem] md:h-[6.5rem]'
          : 'h-7 w-auto sm:h-8',
      )}
      onError={() => setImageFailed(true)}
    />
  )
}

function DateSectionHeader({
  kickoffIso,
  matchCount,
}: {
  kickoffIso: string
  matchCount: number
}) {
  const countLabel = matchCount === 1 ? '1 match' : `${matchCount} matches`

  return (
    <div className="mb-2.5 sm:mb-3">
      <div className="flex items-end justify-between gap-3">
        <h3 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
          {formatDateHeader(kickoffIso)}
        </h3>
        <span className="shrink-0 pb-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {countLabel}
        </span>
      </div>
      <div
        className="mt-2 h-px w-full bg-gradient-to-r from-border via-border/70 to-transparent"
        aria-hidden
      />
    </div>
  )
}

function MatchCard({
  match,
  mounted,
  nowMs,
}: {
  match: UpcomingMatch
  mounted: boolean
  nowMs: number
}) {
  const countdown = mounted ? getCountdownLabel(match.kickoff_at, nowMs) : null
  const groupAccentLabel = formatGroupAccentLabel(match.round, match.group_name)

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border border-primary/20',
        'bg-gradient-to-br from-card via-card to-primary/[0.06]',
        'px-3 py-3.5 sm:rounded-[1.25rem] sm:px-5 sm:py-4',
        'shadow-[0_2px_14px_rgba(0,0,0,0.32)]',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-[11px]">
          {groupAccentLabel}
        </p>
        {countdown ? (
          <div
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30',
              'bg-primary/10 px-2 py-0.5 text-[10px] font-semibold leading-tight text-primary sm:text-[11px]',
            )}
            suppressHydrationWarning
          >
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            <span>{countdown}</span>
          </div>
        ) : (
          <span className="sr-only">Kickoff scheduled</span>
        )}
      </div>

      {/* Mobile: stacked flag + full name per side */}
      <div className="flex items-center gap-1 sm:hidden">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <TeamFlagImage
            countryName={match.team1_name}
            dbFlag={match.team1_flag}
            size="matchup"
          />
          <span className="w-full text-center text-sm font-bold leading-snug text-foreground break-words">
            {match.team1_name}
          </span>
        </div>

        <span
          className="shrink-0 self-center px-0.5 text-[9px] font-normal uppercase tracking-wide text-muted-foreground/40"
          aria-hidden
        >
          vs
        </span>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <TeamFlagImage
            countryName={match.team2_name}
            dbFlag={match.team2_flag}
            size="matchup"
          />
          <span className="w-full text-center text-sm font-bold leading-snug text-foreground break-words">
            {match.team2_name}
          </span>
        </div>
      </div>

      {/* Desktop: flags at edges, names + VS centered as one group */}
      <div className="hidden items-center sm:flex">
        <TeamFlagImage
          countryName={match.team1_name}
          dbFlag={match.team1_flag}
          size="matchup"
        />

        <div className="flex min-w-0 flex-1 items-center justify-center px-1 md:px-2">
          <div className="flex max-w-full min-w-0 items-center justify-center gap-2">
            <span className="min-w-0 shrink truncate text-2xl font-bold leading-tight text-foreground md:text-3xl">
              {match.team1_name}
            </span>
            <span
              className="shrink-0 px-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground/40"
              aria-hidden
            >
              vs
            </span>
            <span className="min-w-0 shrink truncate text-2xl font-bold leading-tight text-foreground md:text-3xl">
              {match.team2_name}
            </span>
          </div>
        </div>

        <TeamFlagImage
          countryName={match.team2_name}
          dbFlag={match.team2_flag}
          size="matchup"
        />
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground sm:mt-3.5">
        <time dateTime={match.kickoff_at} suppressHydrationWarning>
          {formatKickoffCompact(match.kickoff_at)}
        </time>
      </p>
    </article>
  )
}

function UpcomingGamesContent({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mx-auto w-full max-w-4xl', className)}>
      <UpcomingGamesPageHeader />
      {children}
    </div>
  )
}

export function UpcomingGamesTab() {
  const [matches, setMatches] = useState<UpcomingMatch[]>(cachedMatches ?? [])
  const [loading, setLoading] = useState(cachedMatches === null)
  const [error, setError] = useState<string | null>(null)
  const { mounted, nowMs } = useClientNow(60_000)

  const loadMatches = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true)
    setError(null)

    const { matches: rows, error: fetchError } = await loadUpcomingMatches()

    if (fetchError) {
      setError(fetchError)
      if (cachedMatches === null) setMatches([])
    } else if (rows) {
      cachedMatches = rows
      setMatches(rows)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadMatches(cachedMatches === null)
  }, [loadMatches])

  const matchesByDay = useMemo(() => groupMatchesByDay(matches), [matches])

  if (loading) {
    return <UpcomingGamesSkeleton />
  }

  if (error) {
    return (
      <UpcomingGamesContent>
        <div className="rounded-[1.125rem] border border-destructive/30 bg-destructive/10 px-5 py-8 text-center sm:px-6 sm:py-10">
          <p className="text-sm text-destructive">Could not load upcoming matches.</p>
          <p className="mt-2 text-xs text-muted-foreground">{error}</p>
        </div>
      </UpcomingGamesContent>
    )
  }

  if (matches.length === 0) {
    return (
      <UpcomingGamesContent>
        <div className="rounded-[1.125rem] border border-dashed border-border bg-card/50 px-5 py-12 text-center sm:px-6 sm:py-14">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="font-display text-xl tracking-wide text-foreground">
            No upcoming matches
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Check back when new fixtures are scheduled. Final matches are hidden once
            results are in.
          </p>
        </div>
      </UpcomingGamesContent>
    )
  }

  return (
    <UpcomingGamesContent>
      <div className="space-y-5 sm:space-y-6">
        {Array.from(matchesByDay.entries()).map(([dayKey, dayMatches]) => (
          <section key={dayKey}>
            <DateSectionHeader
              kickoffIso={dayMatches[0]!.kickoff_at}
              matchCount={dayMatches.length}
            />
            <ul className="space-y-2.5">
              {dayMatches.map((match) => (
                <li key={match.id}>
                  <MatchCard match={match} mounted={mounted} nowMs={nowMs} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </UpcomingGamesContent>
  )
}
