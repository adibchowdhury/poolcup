'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Clock } from 'lucide-react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'
import {
  fetchUpcomingMatches,
  type UpcomingMatch,
} from '../lib/fetch-upcoming-matches'
import {
  formatDateHeader,
  formatGroupAccentLabel,
  formatKickoffCompact,
  getCountdownLabel,
  groupMatchesByDay,
} from '../lib/upcoming-match-display'
import { supabase } from '../lib/supabase-mobile'

function DateSectionHeader({
  kickoffIso,
  matchCount,
}: {
  kickoffIso: string
  matchCount: number
}) {
  const countLabel = matchCount === 1 ? '1 match' : `${matchCount} matches`

  return (
    <div className="mb-2.5">
      <div className="flex items-end justify-between gap-3">
        <h3 className="font-display text-xl tracking-wide text-foreground">
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

function MobileMatchCard({
  match,
  mounted,
  nowMs,
  onOpen,
}: {
  match: UpcomingMatch
  mounted: boolean
  nowMs: number
  onOpen: (matchId: string) => void
}) {
  const countdown = mounted ? getCountdownLabel(match.kickoff_at, nowMs) : null
  const groupAccentLabel = formatGroupAccentLabel(match.round, match.group_name)

  return (
    <button
      type="button"
      onClick={() => onOpen(match.id)}
      className={cn(
        'w-full overflow-hidden rounded-2xl border border-primary/20 text-left',
        'bg-gradient-to-br from-card via-card to-primary/[0.06]',
        'px-3 py-3.5 shadow-[0_2px_14px_rgba(0,0,0,0.32)] transition-colors',
        'hover:border-primary/35 active:bg-card/80',
      )}
      aria-label={`${match.team1_name} vs ${match.team2_name}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          {groupAccentLabel}
        </p>
        {countdown ? (
          <div
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30',
              'bg-primary/10 px-2 py-0.5 text-[10px] font-semibold leading-tight text-primary',
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

      <div className="flex items-center gap-1">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <TeamFlagImage
            countryName={match.team1_name}
            dbFlag={match.team1_flag}
            imgClassName="aspect-[3/2] h-[3.75rem] w-auto object-cover"
            emojiClassName="text-4xl leading-none"
          />
          <span className="w-full break-words text-center text-sm font-bold leading-snug text-foreground">
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
            imgClassName="aspect-[3/2] h-[3.75rem] w-auto object-cover"
            emojiClassName="text-4xl leading-none"
          />
          <span className="w-full break-words text-center text-sm font-bold leading-snug text-foreground">
            {match.team2_name}
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        <time dateTime={match.kickoff_at} suppressHydrationWarning>
          {formatKickoffCompact(match.kickoff_at)}
        </time>
      </p>
    </button>
  )
}

function MatchesLoadingState() {
  return (
    <div
      className="flex flex-1 flex-col px-4 py-6"
      aria-busy="true"
      aria-label="Loading upcoming matches"
    >
      <div className="mx-auto w-full max-w-lg space-y-5">
        <div className="border-b border-border/50 pb-4">
          <div className="h-8 w-48 animate-pulse rounded bg-muted/40" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted/30" />
        </div>
        {[0, 1].map((section) => (
          <div key={section} className="space-y-2.5">
            <div className="h-6 w-40 animate-pulse rounded bg-muted/40" />
            <div className="h-36 animate-pulse rounded-2xl bg-muted/30" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function MobileMatchesTab({
  onOpenMatch,
}: {
  onOpenMatch: (matchId: string) => void
}) {
  const [matches, setMatches] = useState<UpcomingMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { mounted, nowMs } = useClientNow(60_000)

  const loadMatches = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { matches: rows, error: fetchError } = await fetchUpcomingMatches(
      supabase,
    )

    if (fetchError) {
      setError(fetchError)
      setMatches([])
    } else {
      setMatches(rows)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void loadMatches()
  }, [loadMatches])

  const matchesByDay = useMemo(() => groupMatchesByDay(matches), [matches])

  if (loading) {
    return <MatchesLoadingState />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-5 border-b border-border/50 pb-4">
          <div className="flex items-start gap-3">
            <Calendar
              className="mt-0.5 h-6 w-6 shrink-0 text-primary"
              aria-hidden
            />
            <div className="min-w-0">
              <h2 className="font-display text-3xl tracking-wide text-foreground">
                UPCOMING GAMES
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Track every upcoming World Cup fixture and see when predictions
                lock.
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-8 text-center">
            <p className="text-sm text-destructive">
              Could not load upcoming matches.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{error}</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-12 text-center">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-display text-xl tracking-wide text-foreground">
              No upcoming matches
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Check back when new fixtures are scheduled. Final matches are
              hidden once results are in.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(matchesByDay.entries()).map(([dayKey, dayMatches]) => (
              <section key={dayKey}>
                <DateSectionHeader
                  kickoffIso={dayMatches[0]!.kickoff_at}
                  matchCount={dayMatches.length}
                />
                <ul className="space-y-2.5">
                  {dayMatches.map((match) => (
                    <li key={match.id}>
                      <MobileMatchCard
                        match={match}
                        mounted={mounted}
                        nowMs={nowMs}
                        onOpen={onOpenMatch}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
