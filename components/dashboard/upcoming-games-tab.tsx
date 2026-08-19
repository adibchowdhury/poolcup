'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { DashboardMatchFilters } from '@/components/dashboard/dashboard-match-filters'
import { DASHBOARD_ALL_EVENT_ID } from '@/components/dashboard/event-pills-row'
import { PremiumMatchCard } from '@/components/dashboard/premium-match-card'
import { MatchLifecycleSections } from '@/components/predict/match-lifecycle-sections'
import { eventMatchesSportBubble } from '@/components/dashboard/sport-bubbles-row'
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
import {
  getMatchLifecycleSection,
  partitionByLifecycleSection,
} from '@/src/lib/match-lifecycle-section'
import {
  DISCOVER_HREF,
  MATCHES_MINE_FILTER,
} from '@/src/lib/mobile-bottom-nav-routes'
import { supabase } from '@/src/lib/supabase'
import {
  fetchUserClassicPoolEvents,
  matchEventIsInUserPools,
} from '@/src/lib/user-pool-events'
import { UPCOMING_HORIZON_DAYS } from '@/src/lib/upcoming-match-horizon'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

const MATCH_CARD_GRID =
  'grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3'

const ALL_EVENT_ID = DASHBOARD_ALL_EVENT_ID

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

type UpcomingGamesTabProps = {
  userId: string
}

/**
 * Matches tab — real sporting_events + in-horizon matches only.
 * Selector mirrors dashboard event pills (events with live / upcoming ≤30d).
 */
export function UpcomingGamesTab({ userId }: UpcomingGamesTabProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const myMatchesActive = searchParams.get('filter') === MATCHES_MINE_FILTER

  const [selectedSportId, setSelectedSportId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState(ALL_EVENT_ID)
  const [events, setEvents] = useState<SportingEvent[]>([])
  const [matches, setMatches] = useState<MatchesTabMatch[]>([])
  const [memberEventIdSet, setMemberEventIdSet] = useState<Set<string>>(
    () => new Set(),
  )
  const [hasClassicPools, setHasClassicPools] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const toggleMyMatches = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (myMatchesActive) {
      params.delete('filter')
    } else {
      params.set('filter', MATCHES_MINE_FILTER)
    }
    router.replace(`/dashboard?${params.toString()}`, { scroll: false })
  }, [myMatchesActive, router, searchParams])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [data, poolEvents] = await Promise.all([
        loadMatchesTabData(),
        fetchUserClassicPoolEvents(supabase, userId),
      ])

      setEvents(data.events)
      setMatches(data.matches)
      setMemberEventIdSet(poolEvents.memberEventIdSet)
      setHasClassicPools(poolEvents.hasClassicPools)
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
      setMemberEventIdSet(new Set())
      setHasClassicPools(false)
      setError(err instanceof Error ? err.message : 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const sportFilteredEvents = useMemo(() => {
    if (!selectedSportId) return events
    return events.filter((event) =>
      eventMatchesSportBubble(event.sport, selectedSportId),
    )
  }, [events, selectedSportId])

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of events) map.set(event.id, event.name)
    return map
  }, [events])

  const visibleMatches = useMemo(() => {
    const sportEventIds = selectedSportId
      ? new Set(sportFilteredEvents.map((event) => event.id))
      : null

    return matches.filter((match) => {
      if (myMatchesActive && !matchEventIsInUserPools(match.event_id, memberEventIdSet)) {
        return false
      }
      if (selectedEventId !== ALL_EVENT_ID && match.event_id !== selectedEventId) {
        return false
      }
      if (sportEventIds && match.event_id && !sportEventIds.has(match.event_id)) {
        return false
      }
      if (sportEventIds && !match.event_id) {
        return false
      }
      return true
    })
  }, [
    matches,
    selectedEventId,
    selectedSportId,
    sportFilteredEvents,
    myMatchesActive,
    memberEventIdSet,
  ])

  const lifecycleBuckets = useMemo(
    () =>
      partitionByLifecycleSection(visibleMatches, (match) =>
        getMatchLifecycleSection(match),
      ),
    [visibleMatches],
  )

  const hasExtraFilters =
    selectedSportId != null || selectedEventId !== ALL_EVENT_ID

  const showMyMatchesEmpty =
    myMatchesActive && !loading && !error && visibleMatches.length === 0

  return (
    <div className="mx-auto w-full max-w-6xl">
      <DashboardMatchFilters
        className="mb-5 pt-3 sm:pt-4"
        hideMatchSlider
        selectedSportId={selectedSportId}
        onSelectedSportIdChange={setSelectedSportId}
        selectedEventId={selectedEventId}
        onSelectedEventIdChange={setSelectedEventId}
        myMatchesActive={myMatchesActive}
        onMyMatchesToggle={toggleMyMatches}
      />

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
            className="mt-4 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      ) : showMyMatchesEmpty ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-12 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          {!hasClassicPools ? (
            <>
              <p className="font-display text-xl tracking-wide text-foreground">
                Join a pool to see your matches
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                My matches shows fixtures from competitions your pools follow.
              </p>
            </>
          ) : hasExtraFilters ? (
            <>
              <p className="font-display text-xl tracking-wide text-foreground">
                No matches match your filters
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Try clearing the sport or event filter, or turn off My matches.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-xl tracking-wide text-foreground">
                No upcoming matches in your pools
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Nothing in the next {UPCOMING_HORIZON_DAYS} days for your pool
                competitions.
              </p>
            </>
          )}
          {!hasClassicPools || !hasExtraFilters ? (
            <Link
              href={DISCOVER_HREF}
              className={`mt-4 inline-flex text-sm font-semibold text-primary hover:underline ${FOCUS_VISIBLE_RING} rounded-sm`}
            >
              Discover pools →
            </Link>
          ) : null}
        </div>
      ) : visibleMatches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-12 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="font-display text-xl tracking-wide text-foreground">
            No matches in the next {UPCOMING_HORIZON_DAYS} days
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Check back when new fixtures fall inside the {UPCOMING_HORIZON_DAYS}
            -day window.
          </p>
        </div>
      ) : (
        <MatchLifecycleSections
          buckets={lifecycleBuckets}
          getKey={(match) => match.id}
          listClassName={MATCH_CARD_GRID}
          renderItem={(match) => (
            <RealMatchCard
              match={match}
              eventLabel={
                match.event_id ? eventNameById.get(match.event_id) : null
              }
            />
          )}
        />
      )}
    </div>
  )
}
