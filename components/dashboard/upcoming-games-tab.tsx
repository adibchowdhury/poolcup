'use client'

import { Calendar, Clock } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useClientNow } from '@/hooks/use-client-now'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { countryNameToFlagSrc, resolveTeamFlagDisplay } from '@/src/lib/team-flags'
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

function formatKickoffLocal(iso: string): string {
  return new Date(iso).toLocaleString(DATE_LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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

function UpcomingGamesSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading upcoming matches">
      {[0, 1].map((section) => (
        <div key={section} className="space-y-3">
          <Skeleton className="h-7 w-48 bg-muted/50" />
          <div className="space-y-3">
            {[0, 1, 2].map((card) => (
              <Skeleton
                key={card}
                className="h-28 w-full rounded-2xl bg-muted/40"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TeamFlagImage({
  countryName,
  dbFlag,
}: {
  countryName: string
  dbFlag: string | null
}) {
  const flagSrc = countryNameToFlagSrc(countryName)
  const [imageFailed, setImageFailed] = useState(false)
  const fallbackLabel = resolveTeamFlagDisplay(countryName, dbFlag)

  useEffect(() => {
    setImageFailed(false)
  }, [flagSrc])

  if (imageFailed) {
    return (
      <span className="text-2xl shrink-0 sm:text-3xl" aria-hidden>
        {fallbackLabel}
      </span>
    )
  }

  return (
    <img
      key={flagSrc}
      src={flagSrc}
      alt={countryName}
      className="h-6 w-auto shrink-0"
      onError={() => setImageFailed(true)}
    />
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
  const roundLabel = formatRoundLabel(match.round, match.group_name)

  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {roundLabel}
        </span>
        {countdown && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {countdown}
          </span>
        )}
      </div>

      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:justify-start">
          <TeamFlagImage countryName={match.team1_name} dbFlag={match.team1_flag} />
          <span className="truncate text-base font-semibold text-foreground sm:text-lg">
            {match.team1_name}
          </span>
        </div>

        <span className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-2">
          vs
        </span>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:justify-end">
          <span className="truncate text-right text-base font-semibold text-foreground sm:text-lg">
            {match.team2_name}
          </span>
          <TeamFlagImage countryName={match.team2_name} dbFlag={match.team2_flag} />
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground sm:text-left">
        <time dateTime={match.kickoff_at}>{formatKickoffLocal(match.kickoff_at)}</time>
      </p>
    </article>
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
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-10 text-center">
        <p className="text-sm text-destructive">Could not load upcoming matches.</p>
        <p className="mt-2 text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
        <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="font-display text-xl tracking-wide text-foreground">
          No upcoming matches
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Check back when new fixtures are scheduled. Final matches are hidden once
          results are in.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {Array.from(matchesByDay.entries()).map(([dayKey, dayMatches]) => (
        <section key={dayKey}>
          <h3 className="mb-4 font-display text-xl tracking-wide text-foreground sm:text-2xl">
            {formatDateHeader(dayMatches[0]!.kickoff_at)}
          </h3>
          <ul className={cn('space-y-3')}>
            {dayMatches.map((match) => (
              <li key={match.id}>
                <MatchCard match={match} mounted={mounted} nowMs={nowMs} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
