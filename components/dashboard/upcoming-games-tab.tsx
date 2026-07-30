'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import {
  EventSelector,
  type EventSelectorItem,
} from '@/components/dashboard/event-selector'
import { PremiumMatchCard } from '@/components/dashboard/premium-match-card'
import {
  listSportingEvents,
  type SportingEvent,
} from '@/src/lib/current-event'
import { fetchInHorizonEventIds } from '@/src/lib/fetch-event-slider-matches'
import {
  fetchMatchesTabMatches,
  isMatchesTabLive,
  type MatchesTabMatch,
} from '@/src/lib/fetch-matches-tab'
import { supabase } from '@/src/lib/supabase'
import {
  formatDateHeader,
  groupScheduleItemsByDay,
} from '@/src/lib/upcoming-match-display'
import { UPCOMING_HORIZON_DAYS } from '@/src/lib/upcoming-match-horizon'

const MATCH_CARD_GRID =
  'grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3'

const ALL_EVENT_ID = 'all'

function sportIconPng(sport: string): string | null {
  const normalized = sport.trim().toLowerCase()
  if (normalized === 'soccer' || normalized === 'football') return 'soccer.png'
  if (normalized === 'basketball') return 'basketball.png'
  if (normalized === 'american_football' || normalized === 'nfl') {
    return 'football.png'
  }
  if (normalized === 'hockey' || normalized === 'nhl') return 'hockey.png'
  if (normalized === 'baseball' || normalized === 'mlb') return 'baseball.png'
  return null
}

function toSelectorItems(events: SportingEvent[]): EventSelectorItem[] {
  return [
    { id: ALL_EVENT_ID, label: 'All', iconPng: null },
    ...events.map((event) => ({
      id: event.id,
      label: event.name,
      iconPng: sportIconPng(event.sport),
    })),
  ]
}

type PrefetchCache = {
  events: SportingEvent[]
  matches: MatchesTabMatch[]
}

let prefetchCache: PrefetchCache | null = null
let prefetchPromise: Promise<PrefetchCache> | null = null

async function loadMatchesTabData(): Promise<PrefetchCache> {
  if (prefetchCache) return prefetchCache
  if (prefetchPromise) return prefetchPromise

  prefetchPromise = (async () => {
    const [allEvents, inHorizonIds] = await Promise.all([
      listSportingEvents(supabase),
      fetchInHorizonEventIds(supabase),
    ])

    const events = allEvents.filter((event) => inHorizonIds.has(event.id))
    const eventIds = events.map((event) => event.id)
    const matches = await fetchMatchesTabMatches(supabase, eventIds)

    const next: PrefetchCache = { events, matches }
    prefetchCache = next
    return next
  })().catch((err) => {
    prefetchPromise = null
    throw err
  })

  return prefetchPromise
}

/** Warm cache while the user is on another dashboard tab. */
export function prefetchUpcomingMatches() {
  void loadMatchesTabData().catch(() => {
    // Prefetch is best-effort; the tab will surface errors on open.
  })
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

function RealMatchCard({
  match,
  eventLabel,
}: {
  match: MatchesTabMatch
  eventLabel?: string | null
}) {
  const isLive = isMatchesTabLive(match.status_short)
  const isFinal =
    match.is_final ||
    ['FT', 'AET', 'PEN'].includes((match.status_short ?? '').toUpperCase())
  const mode = isFinal ? 'final' : isLive ? 'live' : 'upcoming'

  return (
    <PremiumMatchCard
      match={match}
      mode={mode}
      competitionName={eventLabel}
      href={`/match/${match.id}`}
    />
  )
}

function MatchesContentSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading matches">
      {[0, 1].map((section) => (
        <div key={section} className="space-y-2.5">
          <div className="h-6 w-40 animate-pulse rounded bg-muted/40" />
          <div className={MATCH_CARD_GRID}>
            <div className="h-[12.25rem] animate-pulse rounded-[1.4rem] bg-muted/30" />
            <div className="hidden h-[12.25rem] animate-pulse rounded-[1.4rem] bg-muted/30 md:block" />
            <div className="hidden h-[12.25rem] animate-pulse rounded-[1.4rem] bg-muted/30 lg:block" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Matches tab — real sporting_events + in-horizon matches only.
 * Selector mirrors dashboard event pills (events with live / upcoming ≤30d).
 */
export function UpcomingGamesTab() {
  const [selectedEventId, setSelectedEventId] = useState(ALL_EVENT_ID)
  const [events, setEvents] = useState<SportingEvent[]>([])
  const [matches, setMatches] = useState<MatchesTabMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Bust stale prefetch after errors; reuse warm cache on happy path.
      const data = await loadMatchesTabData()
      setEvents(data.events)
      setMatches(data.matches)
      setSelectedEventId((prev) => {
        if (prev === ALL_EVENT_ID) return prev
        if (data.events.some((event) => event.id === prev)) return prev
        return ALL_EVENT_ID
      })
    } catch (err) {
      prefetchCache = null
      prefetchPromise = null
      setEvents([])
      setMatches([])
      setError(err instanceof Error ? err.message : 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectorEvents = useMemo(() => toSelectorItems(events), [events])

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of events) map.set(event.id, event.name)
    return map
  }, [events])

  const visibleMatches = useMemo(() => {
    if (selectedEventId === ALL_EVENT_ID) return matches
    return matches.filter((match) => match.event_id === selectedEventId)
  }, [matches, selectedEventId])

  const matchesByDay = useMemo(
    () => groupScheduleItemsByDay(visibleMatches),
    [visibleMatches],
  )

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-5">
        {loading && events.length === 0 ? (
          <div className="flex gap-3 overflow-hidden py-1.5" aria-hidden>
            <div className="h-10 w-16 animate-pulse rounded bg-muted/40" />
            <div className="h-10 w-28 animate-pulse rounded bg-muted/40" />
            <div className="h-10 w-24 animate-pulse rounded bg-muted/40" />
          </div>
        ) : events.length > 0 ? (
          <EventSelector
            events={selectorEvents}
            selectedId={selectedEventId}
            onSelect={setSelectedEventId}
          />
        ) : null}
      </div>

      {loading && matches.length === 0 ? (
        <MatchesContentSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-8 text-center">
          <p className="text-sm text-destructive">
            Could not load upcoming matches.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{error}</p>
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      ) : visibleMatches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-12 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="font-display text-xl tracking-wide text-foreground">
            No upcoming matches in the next {UPCOMING_HORIZON_DAYS} days
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Check back when new fixtures fall inside the {UPCOMING_HORIZON_DAYS}
            -day window.
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
                      eventLabel={
                        match.event_id
                          ? eventNameById.get(match.event_id)
                          : null
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
