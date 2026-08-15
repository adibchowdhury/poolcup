'use client'

import { useEffect, useMemo, useState } from 'react'
import { PremiumMatchCard } from '@/components/dashboard/premium-match-card'
import { eventMatchesSportBubble } from '@/components/dashboard/sport-bubbles-row'
import { cn } from '@/lib/utils'
import {
  listSportingEvents,
  type SportingEvent,
} from '@/src/lib/current-event'
import {
  EVENT_SLIDER_MATCH_LIMIT,
  fetchEventSliderMatches,
  fetchInHorizonEventIds,
  sortEventSliderMatches,
  type EventSliderMatch,
} from '@/src/lib/fetch-event-slider-matches'
import { UPCOMING_HORIZON_DAYS } from '@/src/lib/upcoming-match-horizon'
import { supabase } from '@/src/lib/supabase'

export const DASHBOARD_ALL_EVENT_ID = 'all'

/** Cap when merging matches across events for "All". */
const ALL_EVENTS_MATCH_LIMIT = EVENT_SLIDER_MATCH_LIMIT * 2

type PrefetchEntry =
  | { status: 'ok'; matches: EventSliderMatch[] }
  | { status: 'error'; message: string }

type MatchCardRow = EventSliderMatch & { competitionName?: string }

type EventPillsRowProps = {
  className?: string
  /** null = all sports. Bubble id from SportBubblesRow. */
  selectedSportId?: string | null
}

/**
 * Real sporting-event pills + inline match slider.
 *
 * Pills: "All" first (default), then events with ≥1 in-horizon match.
 * Filtered by selectedSportId when a sport bubble is active.
 */
export function EventPillsRow({
  className,
  selectedSportId = null,
}: EventPillsRowProps) {
  const [events, setEvents] = useState<SportingEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>(
    DASHBOARD_ALL_EVENT_ID,
  )
  const [matchesByEventId, setMatchesByEventId] = useState<
    Record<string, PrefetchEntry>
  >({})
  const [prefetchLoading, setPrefetchLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function prefetchAll() {
      setPrefetchLoading(true)
      setEventsError(null)

      try {
        const [allEvents, inHorizonIds] = await Promise.all([
          listSportingEvents(supabase),
          fetchInHorizonEventIds(supabase),
        ])
        if (cancelled) return

        const qualifying = allEvents.filter((event) =>
          inHorizonIds.has(event.id),
        )

        setEvents(qualifying)
        setSelectedEventId((prev) => {
          if (prev === DASHBOARD_ALL_EVENT_ID) return DASHBOARD_ALL_EVENT_ID
          if (prev && qualifying.some((e) => e.id === prev)) return prev
          return DASHBOARD_ALL_EVENT_ID
        })

        if (qualifying.length === 0) {
          setMatchesByEventId({})
          return
        }

        const results = await Promise.all(
          qualifying.map(async (event) => {
            try {
              const matches = await fetchEventSliderMatches(supabase, event.id)
              return [
                event.id,
                { status: 'ok', matches } satisfies PrefetchEntry,
              ] as const
            } catch (err) {
              return [
                event.id,
                {
                  status: 'error',
                  message:
                    err instanceof Error
                      ? err.message
                      : 'Failed to load matches',
                } satisfies PrefetchEntry,
              ] as const
            }
          }),
        )

        if (cancelled) return

        const map: Record<string, PrefetchEntry> = {}
        for (const [id, entry] of results) {
          map[id] = entry
        }
        setMatchesByEventId(map)
      } catch (err) {
        if (!cancelled) {
          setEventsError(
            err instanceof Error ? err.message : 'Failed to load events',
          )
        }
      } finally {
        if (!cancelled) setPrefetchLoading(false)
      }
    }

    void prefetchAll()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleEvents = useMemo(() => {
    if (!selectedSportId) return events
    return events.filter((event) =>
      eventMatchesSportBubble(event.sport, selectedSportId),
    )
  }, [events, selectedSportId])

  // Sport change / list shrink: keep "All", or reset if specific event left scope.
  useEffect(() => {
    if (selectedEventId === DASHBOARD_ALL_EVENT_ID) return
    if (!visibleEvents.some((e) => e.id === selectedEventId)) {
      setSelectedEventId(DASHBOARD_ALL_EVENT_ID)
    }
  }, [visibleEvents, selectedEventId])

  // When sport switches, default back to All for that scope.
  useEffect(() => {
    setSelectedEventId(DASHBOARD_ALL_EVENT_ID)
  }, [selectedSportId])

  const selectedEvent =
    selectedEventId === DASHBOARD_ALL_EVENT_ID
      ? null
      : (visibleEvents.find((e) => e.id === selectedEventId) ?? null)

  const visibleMatchRows: MatchCardRow[] = useMemo(() => {
    if (selectedEventId === DASHBOARD_ALL_EVENT_ID) {
      const nameByMatchId = new Map<string, string>()
      const merged: EventSliderMatch[] = []

      for (const event of visibleEvents) {
        const entry = matchesByEventId[event.id]
        if (!entry || entry.status !== 'ok') continue
        for (const match of entry.matches) {
          if (nameByMatchId.has(match.id)) continue
          nameByMatchId.set(match.id, event.name)
          merged.push(match)
        }
      }

      return sortEventSliderMatches(merged)
        .slice(0, ALL_EVENTS_MATCH_LIMIT)
        .map((match) => ({
          ...match,
          competitionName: nameByMatchId.get(match.id),
        }))
    }

    const entry = matchesByEventId[selectedEventId]
    if (!entry || entry.status !== 'ok') return []
    return entry.matches.map((match) => ({
      ...match,
      competitionName: selectedEvent?.name,
    }))
  }, [
    selectedEventId,
    visibleEvents,
    matchesByEventId,
    selectedEvent?.name,
  ])

  const selectedEntryError =
    selectedEventId !== DASHBOARD_ALL_EVENT_ID
      ? matchesByEventId[selectedEventId]
      : undefined

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className="min-w-0 max-w-full -mx-1 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Sporting events"
      >
        <div className="inline-flex min-w-full items-center gap-2 whitespace-nowrap sm:gap-2.5">
          {prefetchLoading ? (
            <>
              <PillSkeleton />
              <PillSkeleton />
            </>
          ) : eventsError ? (
            <p className="text-sm text-muted-foreground">{eventsError}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events in the next {UPCOMING_HORIZON_DAYS} days.
            </p>
          ) : (
            <>
              <button
                type="button"
                role="listitem"
                aria-pressed={selectedEventId === DASHBOARD_ALL_EVENT_ID}
                onClick={() => setSelectedEventId(DASHBOARD_ALL_EVENT_ID)}
                className={cn(
                  'inline-flex shrink-0 cursor-pointer select-none items-center rounded-full',
                  'border px-3.5 py-1.5 text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  selectedEventId === DASHBOARD_ALL_EVENT_ID
                    ? 'border-primary bg-primary font-semibold text-primary-foreground'
                    : 'border-border/70 bg-transparent font-normal text-muted-foreground hover:border-border hover:text-foreground/80',
                )}
              >
                All
              </button>
              {visibleEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No events for this sport right now.
                </p>
              ) : (
                visibleEvents.map((event) => {
                  const selected = event.id === selectedEventId

                  return (
                    <button
                      key={event.id}
                      type="button"
                      role="listitem"
                      aria-pressed={selected}
                      onClick={() => setSelectedEventId(event.id)}
                      className={cn(
                        'inline-flex shrink-0 cursor-pointer select-none items-center rounded-full',
                        'border px-3.5 py-1.5 text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                        selected
                          ? 'border-primary bg-primary font-semibold text-primary-foreground'
                          : 'border-border/70 bg-transparent font-normal text-muted-foreground hover:border-border hover:text-foreground/80',
                      )}
                    >
                      {event.name}
                    </button>
                  )
                })
              )}
            </>
          )}
        </div>
      </div>

      {prefetchLoading ? (
        <div
          className="@container flex min-w-0 gap-3 px-1"
          aria-busy="true"
          aria-label="Loading matches"
        >
          <MatchCardSkeleton />
          <MatchCardSkeleton />
        </div>
      ) : events.length === 0 ? null : (
        <div
          className="@container min-w-0 max-w-full -mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label={
            selectedEvent
              ? `${selectedEvent.name} matches`
              : selectedSportId
                ? 'Matches for selected sport'
                : 'All matches'
          }
        >
          {selectedEventId !== DASHBOARD_ALL_EVENT_ID &&
          selectedEntryError?.status === 'error' ? (
            <p className="px-1 text-sm text-muted-foreground">
              {selectedEntryError.message}
            </p>
          ) : visibleMatchRows.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              {selectedEventId === DASHBOARD_ALL_EVENT_ID
                ? selectedSportId
                  ? 'No matches for this sport yet.'
                  : 'No matches yet.'
                : 'No matches for this event yet.'}
            </p>
          ) : (
            <div className="flex min-w-0 gap-3">
              {visibleMatchRows.map((match) => (
                <div
                  key={match.id}
                  role="listitem"
                  className="w-[min(85cqi,20rem)] shrink-0 overflow-hidden sm:w-[22rem]"
                >
                  <PremiumMatchCard
                    match={match}
                    mode={match.mode}
                    competitionName={match.competitionName}
                    href={`/match/${match.id}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PillSkeleton() {
  return (
    <div
      className="h-8 w-36 shrink-0 animate-pulse rounded-full bg-muted/60"
      aria-hidden
    />
  )
}

function MatchCardSkeleton() {
  return (
    <div
      className="h-[12.25rem] w-[min(85cqi,20rem)] shrink-0 animate-pulse rounded-[1.4rem] border border-border/60 bg-muted/40 sm:w-[22rem]"
      aria-hidden
    />
  )
}
