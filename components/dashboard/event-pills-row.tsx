'use client'

import { useEffect, useState } from 'react'
import { LiveScoreboardCard } from '@/components/dashboard/live-scoreboard'
import { cn } from '@/lib/utils'
import {
  listSportingEvents,
  type SportingEvent,
} from '@/src/lib/current-event'
import {
  fetchEventSliderMatches,
  type EventSliderMatch,
} from '@/src/lib/fetch-event-slider-matches'
import { supabase } from '@/src/lib/supabase'

type PrefetchEntry =
  | { status: 'ok'; matches: EventSliderMatch[] }
  | { status: 'error'; message: string }

/**
 * Real sporting-event pills + inline match slider.
 * Prefetches each event's slider matches once on mount; pill clicks only
 * swap the selected event id — no re-fetch, no loading flash.
 */
export function EventPillsRow({ className }: { className?: string }) {
  const [events, setEvents] = useState<SportingEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
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
        const rows = await listSportingEvents(supabase)
        if (cancelled) return

        setEvents(rows)
        setSelectedEventId((prev) => prev ?? rows[0]?.id ?? null)

        if (rows.length === 0) {
          setMatchesByEventId({})
          return
        }

        const results = await Promise.all(
          rows.map(async (event) => {
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

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null
  const selectedEntry =
    selectedEventId != null ? matchesByEventId[selectedEventId] : undefined

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            events.map((event) => {
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
        </div>
      </div>

      {prefetchLoading ? (
        <div className="flex gap-3 px-1" aria-busy="true" aria-label="Loading matches">
          <MatchCardSkeleton />
          <MatchCardSkeleton />
        </div>
      ) : selectedEventId ? (
        <div
          className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label={
            selectedEvent
              ? `${selectedEvent.name} matches`
              : 'Event matches'
          }
        >
          {!selectedEntry || selectedEntry.status === 'error' ? (
            <p className="px-1 text-sm text-muted-foreground">
              {selectedEntry?.status === 'error'
                ? selectedEntry.message
                : 'No matches for this event yet.'}
            </p>
          ) : selectedEntry.matches.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              No matches for this event yet.
            </p>
          ) : (
            <div className="flex gap-3">
              {selectedEntry.matches.map((match) => (
                <div
                  key={match.id}
                  role="listitem"
                  className="w-[min(85vw,20rem)] shrink-0 sm:w-[22rem]"
                >
                  <LiveScoreboardCard
                    match={match}
                    mode={match.mode}
                    compact
                    matchHref={`/match/${match.id}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
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
      className="h-[4.5rem] w-[min(85vw,20rem)] shrink-0 animate-pulse rounded-xl border border-border/60 bg-muted/40 sm:w-[22rem]"
      aria-hidden
    />
  )
}
