'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Clock } from 'lucide-react'
import { EventSelector } from '@/components/dashboard/event-selector'
import {
  MatchListCard,
  TeamMonogram,
} from '@/components/dashboard/match-list-card'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'
import {
  getAllMockFixtures,
  getMockFixturesForSport,
  groupMockFixturesByDay,
  MOCK_SPORT_EVENTS,
  type MockFixture,
  type MockFixtureWithSport,
} from '@/src/lib/mock-sports-fixtures'
import { supabase } from '@/src/lib/supabase'
import { resolveCurrentEventId } from '@/src/lib/current-event'
import {
  formatDateHeader,
  formatGroupAccentLabel,
  formatKickoffCompact,
  getCountdownLabel,
  groupMatchesByDay,
  groupScheduleItemsByDay,
  type UpcomingMatch,
} from '@/src/lib/upcoming-match-display'

/** Tournament has 72 fixtures; fetch all upcoming rows in one query. */
const UPCOMING_MATCHES_QUERY_LIMIT = 100

let cachedMatches: UpcomingMatch[] | null = null
let loadPromise: Promise<{
  matches: UpcomingMatch[] | null
  error: string | null
}> | null = null

async function fetchUpcomingMatchesFromDb(): Promise<{
  matches: UpcomingMatch[] | null
  error: string | null
}> {
  const eventId = await resolveCurrentEventId(supabase)

  let query = supabase
    .from('matches')
    .select(
      'id, kickoff_at, team1_name, team2_name, team1_flag, team2_flag, group_name, round',
    )
    .gt('kickoff_at', new Date().toISOString())
    .eq('is_final', false)
    .order('kickoff_at', { ascending: true })
    .limit(UPCOMING_MATCHES_QUERY_LIMIT)
  if (eventId) query = query.eq('event_id', eventId)

  const { data, error: fetchError } = await query

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

const MATCH_CARD_GRID =
  'grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3'

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

function CountdownPill({ label }: { label: string }) {
  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30',
        'bg-primary/10 px-2 py-0.5 text-[10px] font-semibold leading-tight text-primary',
      )}
      suppressHydrationWarning
    >
      <Clock className="h-3 w-3 shrink-0" aria-hidden />
      <span>{label}</span>
    </div>
  )
}

function LivePill({ label }: { label: string }) {
  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-red-500/40',
        'bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase leading-tight text-red-400',
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-400" />
      <span>Live · {label}</span>
    </div>
  )
}

function RealMatchCard({
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
    <MatchListCard
      accentLabel={groupAccentLabel}
      headerRight={
        countdown ? (
          <CountdownPill label={countdown} />
        ) : (
          <span className="sr-only">Kickoff scheduled</span>
        )
      }
      team1Name={match.team1_name}
      team2Name={match.team2_name}
      team1Visual={
        <TeamFlagImage
          countryName={match.team1_name}
          dbFlag={match.team1_flag}
          imgClassName="aspect-[3/2] h-[3.75rem] w-auto object-cover"
          emojiClassName="text-4xl leading-none"
        />
      }
      team2Visual={
        <TeamFlagImage
          countryName={match.team2_name}
          dbFlag={match.team2_flag}
          imgClassName="aspect-[3/2] h-[3.75rem] w-auto object-cover"
          emojiClassName="text-4xl leading-none"
        />
      }
      centerContent={
        <span
          className="text-[9px] font-normal uppercase tracking-wide text-muted-foreground/40"
          aria-hidden
        >
          vs
        </span>
      }
      footer={
        <p className="mt-3 text-center text-xs text-muted-foreground">
          <time dateTime={match.kickoff_at} suppressHydrationWarning>
            {formatKickoffCompact(match.kickoff_at)}
          </time>
        </p>
      }
      interactive
      href={`/match/${match.id}`}
      ariaLabel={`${match.team1_name} vs ${match.team2_name}`}
    />
  )
}

function MockMatchCard({
  fixture,
  mounted,
  nowMs,
  sportLabel,
}: {
  fixture: MockFixture
  mounted: boolean
  nowMs: number
  sportLabel?: string
}) {
  const isLive = fixture.status === 'live'
  const countdown =
    !isLive && mounted ? getCountdownLabel(fixture.kickoff_at, nowMs) : null
  const accentLabel = sportLabel
    ? `${sportLabel} · ${fixture.round_label}`.toUpperCase()
    : fixture.round_label.toUpperCase()

  return (
    <MatchListCard
      accentLabel={accentLabel}
      headerRight={
        isLive ? (
          <LivePill label={fixture.live_label ?? 'Now'} />
        ) : countdown ? (
          <CountdownPill label={countdown} />
        ) : (
          <span className="sr-only">Kickoff scheduled</span>
        )
      }
      team1Name={fixture.team1_name}
      team2Name={fixture.team2_name}
      team1Visual={<TeamMonogram code={fixture.team1_code} />}
      team2Visual={<TeamMonogram code={fixture.team2_code} />}
      centerContent={
        isLive && fixture.score1 != null && fixture.score2 != null ? (
          <p className="font-display text-2xl leading-none tracking-wide tabular-nums text-primary">
            {fixture.score1}
            <span className="mx-0.5 text-muted-foreground/70">–</span>
            {fixture.score2}
          </p>
        ) : (
          <span
            className="text-[9px] font-normal uppercase tracking-wide text-muted-foreground/40"
            aria-hidden
          >
            vs
          </span>
        )
      }
      footer={
        isLive ? (
          <p className="mt-3 text-center text-xs font-medium text-red-400/90">
            Mock preview — not a real match
          </p>
        ) : (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            <time dateTime={fixture.kickoff_at} suppressHydrationWarning>
              {formatKickoffCompact(fixture.kickoff_at)}
            </time>
          </p>
        )
      }
      interactive={false}
      ariaLabel={`${fixture.team1_name} vs ${fixture.team2_name} (mock)`}
    />
  )
}

type CombinedScheduleItem =
  | { kind: 'real'; kickoff_at: string; match: UpcomingMatch }
  | {
      kind: 'mock'
      kickoff_at: string
      fixture: MockFixtureWithSport
    }

function MatchesContentSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading matches">
      {[0, 1].map((section) => (
        <div key={section} className="space-y-2.5">
          <div className="h-6 w-40 animate-pulse rounded bg-muted/40" />
          <div className={MATCH_CARD_GRID}>
            <div className="h-36 animate-pulse rounded-2xl bg-muted/30" />
            <div className="hidden h-36 animate-pulse rounded-2xl bg-muted/30 md:block" />
            <div className="hidden h-36 animate-pulse rounded-2xl bg-muted/30 lg:block" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function UpcomingGamesTab() {
  const [selectedEventId, setSelectedEventId] = useState('all')
  const [matches, setMatches] = useState<UpcomingMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { mounted, nowMs } = useClientNow(60_000)

  const isAll = selectedEventId === 'all'
  const isWorldCup = selectedEventId === 'wc'
  const isMockSport = !isAll && !isWorldCup
  const allMockFixtures = useMemo(() => getAllMockFixtures(), [])

  const loadMatches = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { matches: rows, error: fetchError } = await loadUpcomingMatches()

    if (fetchError) {
      setError(fetchError)
      setMatches([])
    } else {
      setMatches(rows ?? [])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void loadMatches()
  }, [loadMatches])

  const matchesByDay = useMemo(() => groupMatchesByDay(matches), [matches])
  const mockFixtures = useMemo(
    () => (isMockSport ? getMockFixturesForSport(selectedEventId) : []),
    [isMockSport, selectedEventId],
  )
  const mockFixturesByDay = useMemo(
    () => groupMockFixturesByDay(mockFixtures),
    [mockFixtures],
  )
  const combinedByDay = useMemo(() => {
    if (!isAll) return null

    const items: CombinedScheduleItem[] = [
      ...matches.map((match) => ({
        kind: 'real' as const,
        kickoff_at: match.kickoff_at,
        match,
      })),
      ...allMockFixtures.map((fixture) => ({
        kind: 'mock' as const,
        kickoff_at: fixture.kickoff_at,
        fixture,
      })),
    ]

    return groupScheduleItemsByDay(items)
  }, [isAll, matches, allMockFixtures])

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-5">
        <EventSelector
          events={MOCK_SPORT_EVENTS}
          selectedId={selectedEventId}
          onSelect={setSelectedEventId}
        />
      </div>

      {isAll ? (
        loading ? (
          <MatchesContentSkeleton />
        ) : combinedByDay && combinedByDay.size > 0 ? (
          <div className="space-y-5">
            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                World Cup matches could not be loaded. Showing mock games only.
                <span className="mt-1 block text-xs text-muted-foreground">
                  {error}
                </span>
              </div>
            ) : null}
            {Array.from(combinedByDay.entries()).map(([dayKey, dayItems]) => (
              <section key={dayKey}>
                <DateSectionHeader
                  kickoffIso={dayItems[0]!.kickoff_at}
                  matchCount={dayItems.length}
                />
                <ul className={MATCH_CARD_GRID}>
                  {dayItems.map((item) =>
                    item.kind === 'real' ? (
                      <li key={item.match.id} className="min-w-0">
                        <RealMatchCard
                          match={item.match}
                          mounted={mounted}
                          nowMs={nowMs}
                        />
                      </li>
                    ) : (
                      <li key={item.fixture.id} className="min-w-0">
                        <MockMatchCard
                          fixture={item.fixture}
                          mounted={mounted}
                          nowMs={nowMs}
                          sportLabel={item.fixture.sportLabel}
                        />
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-8 text-center">
                <p className="text-sm text-destructive">
                  Could not load upcoming matches.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{error}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-12 text-center">
                <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="font-display text-xl tracking-wide text-foreground">
                  No upcoming matches
                </p>
              </div>
            )}
          </div>
        )
      ) : isWorldCup ? (
        loading ? (
          <MatchesContentSkeleton />
        ) : error ? (
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
                <ul className={MATCH_CARD_GRID}>
                  {dayMatches.map((match) => (
                    <li key={match.id} className="min-w-0">
                      <RealMatchCard
                        match={match}
                        mounted={mounted}
                        nowMs={nowMs}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : mockFixtures.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No mock fixtures for this sport.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(mockFixturesByDay.entries()).map(
            ([dayKey, dayFixtures]) => (
              <section key={dayKey}>
                <DateSectionHeader
                  kickoffIso={dayFixtures[0]!.kickoff_at}
                  matchCount={dayFixtures.length}
                />
                <ul className={MATCH_CARD_GRID}>
                  {dayFixtures.map((fixture) => (
                    <li key={fixture.id} className="min-w-0">
                      <MockMatchCard
                        fixture={fixture}
                        mounted={mounted}
                        nowMs={nowMs}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  )
}
