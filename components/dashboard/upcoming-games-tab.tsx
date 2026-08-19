'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { DashboardMatchFilters } from '@/components/dashboard/dashboard-match-filters'
import type { MatchesScope } from '@/components/dashboard/matches-scope-segmented-control'
import { DASHBOARD_ALL_EVENT_ID } from '@/components/dashboard/event-pills-row'
import { MatchesTabMatchCard } from '@/components/dashboard/matches-tab-match-card'
import { MatchesTabGroupedSections } from '@/components/dashboard/matches-tab-grouped-sections'
import { MatchLifecycleSections } from '@/components/predict/match-lifecycle-sections'
import { eventMatchesSportBubble } from '@/components/dashboard/sport-bubbles-row'
import {
  listSportingEvents,
  type SportingEvent,
} from '@/src/lib/current-event'
import { fetchInHorizonEventIds } from '@/src/lib/fetch-event-slider-matches'
import {
  fetchMatchesTabMatches,
  type MatchesTabMatch,
} from '@/src/lib/fetch-matches-tab'
import {
  fetchMatchesTabPredictionSummaries,
  type MatchesTabPredictionSummary,
} from '@/src/lib/fetch-matches-tab-predictions'
import {
  getMatchLifecycleSection,
  partitionByLifecycleSection,
} from '@/src/lib/match-lifecycle-section'
import {
  buildMatchesTabDateGroups,
  type MatchesTabDateGroup,
} from '@/src/lib/matches-tab-date-groups'
import {
  DISCOVER_HREF,
  MATCHES_MINE_FILTER,
} from '@/src/lib/mobile-bottom-nav-routes'
import { supabase } from '@/src/lib/supabase'
import {
  fetchUserClassicPoolEvents,
  matchEventIsInUserPools,
} from '@/src/lib/user-pool-events'
import {
  DASHBOARD_MATCHES_EMPTY_STATE_CLASS,
  DASHBOARD_MATCHES_GRID_CLASS,
} from '@/src/lib/dashboard-surfaces'
import { UPCOMING_HORIZON_DAYS } from '@/src/lib/upcoming-match-horizon'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

const MATCH_CARD_GRID = DASHBOARD_MATCHES_GRID_CLASS

const ALL_EVENT_ID = DASHBOARD_ALL_EVENT_ID

/** Dev-only — localStorage.setItem('matches-tab-perf', '1') then toggle scope. */
const MATCHES_TAB_PERF =
  process.env.NODE_ENV === 'development' &&
  typeof window !== 'undefined' &&
  window.localStorage?.getItem('matches-tab-perf') === '1'

function matchesScopeFromUrlFilter(filter: string | null): MatchesScope {
  return filter === MATCHES_MINE_FILTER ? 'mine' : 'all'
}

/** Deep-link sync without router.replace — avoids RSC round-trip on toggle. */
function syncMatchesScopeUrl(scope: MatchesScope) {
  const url = new URL(window.location.href)
  if (scope === 'mine') {
    url.searchParams.set('filter', MATCHES_MINE_FILTER)
  } else {
    url.searchParams.delete('filter')
  }
  const next = `${url.pathname}${url.search}${url.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next !== current) {
    window.history.replaceState(window.history.state, '', next)
  }
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

function MatchesContentSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Loading matches">
      {[0, 1].map((section) => (
        <div key={section} className="space-y-2.5">
          <div className="h-6 w-40 animate-pulse rounded bg-muted/40" />
          <div className={MATCH_CARD_GRID}>
            <div className="h-[220px] animate-pulse rounded-[1.4rem] bg-muted/30 lg:h-[240px]" />
            <div className="hidden h-[220px] animate-pulse rounded-[1.4rem] bg-muted/30 md:block lg:h-[240px]" />
            <div className="hidden h-[220px] animate-pulse rounded-[1.4rem] bg-muted/30 lg:block lg:h-[240px]" />
            <div className="hidden h-[220px] animate-pulse rounded-[1.4rem] bg-muted/30 xl:block lg:h-[240px]" />
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
  const searchParams = useSearchParams()
  const [matchesScope, setMatchesScopeState] = useState<MatchesScope>(() =>
    matchesScopeFromUrlFilter(searchParams.get('filter')),
  )
  const scopeSwapStartedAtRef = useRef<number | null>(null)

  const [selectedSportId, setSelectedSportId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState(ALL_EVENT_ID)
  const [events, setEvents] = useState<SportingEvent[]>([])
  const [matches, setMatches] = useState<MatchesTabMatch[]>([])
  const [memberEventIdSet, setMemberEventIdSet] = useState<Set<string>>(
    () => new Set(),
  )
  const [hasClassicPools, setHasClassicPools] = useState(false)
  const [predictionByMatchId, setPredictionByMatchId] = useState<
    Map<string, MatchesTabPredictionSummary>
  >(() => new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const setMatchesScope = useCallback((scope: MatchesScope) => {
    if (MATCHES_TAB_PERF) {
      scopeSwapStartedAtRef.current = performance.now()
    }
    setMatchesScopeState(scope)
    syncMatchesScopeUrl(scope)
  }, [])

  useEffect(() => {
    const fromUrl = matchesScopeFromUrlFilter(searchParams.get('filter'))
    setMatchesScopeState((prev) => (prev === fromUrl ? prev : fromUrl))
  }, [searchParams])

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      setMatchesScopeState(matchesScopeFromUrlFilter(params.get('filter')))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const handleSportChange = useCallback((next: string | null) => {
    setSelectedSportId(next)
    setSelectedEventId(ALL_EVENT_ID)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [data, poolEvents] = await Promise.all([
        loadMatchesTabData(),
        fetchUserClassicPoolEvents(supabase, userId),
      ])

      const predictions = await fetchMatchesTabPredictionSummaries(
        supabase,
        data.matches,
        poolEvents.memberships,
      )

      setEvents(data.events)
      setMatches(data.matches)
      setMemberEventIdSet(poolEvents.memberEventIdSet)
      setHasClassicPools(poolEvents.hasClassicPools)
      setPredictionByMatchId(predictions)
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
      setPredictionByMatchId(new Map())
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

  const sportEventIds = useMemo(
    () =>
      selectedSportId
        ? new Set(sportFilteredEvents.map((event) => event.id))
        : null,
    [selectedSportId, sportFilteredEvents],
  )

  const sportEventFilteredMatches = useMemo(() => {
    if (!sportEventIds && selectedEventId === ALL_EVENT_ID) return matches

    return matches.filter((match) => {
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
  }, [matches, selectedEventId, sportEventIds])

  const mineFilteredMatches = useMemo(() => {
    if (memberEventIdSet.size === 0) return []
    return sportEventFilteredMatches.filter((match) =>
      matchEventIsInUserPools(match.event_id, memberEventIdSet),
    )
  }, [sportEventFilteredMatches, memberEventIdSet])

  const visibleMatches =
    matchesScope === 'mine' ? mineFilteredMatches : sportEventFilteredMatches

  const desktopDateGroupsByScope = useMemo(() => {
    const t0 = MATCHES_TAB_PERF ? performance.now() : 0
    const allGroups = buildMatchesTabDateGroups(sportEventFilteredMatches)
    const mineGroups = buildMatchesTabDateGroups(mineFilteredMatches)
    if (MATCHES_TAB_PERF) {
      console.log(
        '[matches-tab] precompute groups',
        (performance.now() - t0).toFixed(2) + 'ms',
        { all: allGroups.length, mine: mineGroups.length },
      )
    }
    return { all: allGroups, mine: mineGroups }
  }, [sportEventFilteredMatches, mineFilteredMatches])

  const desktopDateGroups =
    matchesScope === 'mine'
      ? desktopDateGroupsByScope.mine
      : desktopDateGroupsByScope.all

  useLayoutEffect(() => {
    if (!MATCHES_TAB_PERF || scopeSwapStartedAtRef.current == null) return
    const elapsed = performance.now() - scopeSwapStartedAtRef.current
    console.log(
      '[matches-tab] scope swap painted',
      elapsed.toFixed(1) + 'ms',
      {
        scope: matchesScope,
        groups: desktopDateGroups.length,
        matches: visibleMatches.length,
      },
    )
    scopeSwapStartedAtRef.current = null
  }, [matchesScope, desktopDateGroups, visibleMatches.length])

  const lifecycleBuckets = useMemo(
    () =>
      partitionByLifecycleSection(visibleMatches, (match) =>
        getMatchLifecycleSection(match),
      ),
    [visibleMatches],
  )

  const showMatchSections = !loading && !error && visibleMatches.length > 0

  const renderMatchCard = useCallback(
    (match: MatchesTabMatch, options?: { liveStrip?: boolean }) => (
      <MatchesTabMatchCard
        match={match}
        eventLabel={match.event_id ? eventNameById.get(match.event_id) : null}
        prediction={predictionByMatchId.get(match.id) ?? null}
        liveStrip={options?.liveStrip}
      />
    ),
    [eventNameById, predictionByMatchId],
  )

  const renderMobileMatchItem = useCallback(
    (match: MatchesTabMatch) => renderMatchCard(match),
    [renderMatchCard],
  )

  const renderDesktopMatchItem = useCallback(
    (match: MatchesTabMatch, group: MatchesTabDateGroup) =>
      renderMatchCard(match, { liveStrip: group.id === 'live' }),
    [renderMatchCard],
  )

  const getMatchKey = useCallback((match: MatchesTabMatch) => match.id, [])

  const renderMobileMatchGrid = (
    buckets: Record<'live' | 'upcoming' | 'completed', MatchesTabMatch[]>,
  ) => (
    <MatchLifecycleSections
      buckets={buckets}
      getKey={getMatchKey}
      listClassName={MATCH_CARD_GRID}
      renderItem={renderMobileMatchItem}
    />
  )

  const renderDesktopMatchGrid = () => (
    <MatchesTabGroupedSections
      groups={desktopDateGroups}
      getKey={getMatchKey}
      renderItem={renderDesktopMatchItem}
    />
  )

  const hasExtraFilters =
    selectedSportId != null || selectedEventId !== ALL_EVENT_ID

  const showMyMatchesEmpty =
    matchesScope === 'mine' &&
    !loading &&
    !error &&
    visibleMatches.length === 0

  return (
    <div className="w-full min-w-0">
      <DashboardMatchFilters
        className="mb-5 pt-3 sm:pt-4 lg:mb-6 lg:pt-0"
        hideMatchSlider
        selectedSportId={selectedSportId}
        onSelectedSportIdChange={handleSportChange}
        selectedEventId={selectedEventId}
        onSelectedEventIdChange={setSelectedEventId}
        matchesScope={matchesScope}
        onMatchesScopeChange={setMatchesScope}
        sportLeagueEvents={sportFilteredEvents}
      />

      {loading && matches.length === 0 ? (
        <MatchesContentSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-8 text-center lg:border-[#292929] lg:bg-[#171717]">
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
        <div className={DASHBOARD_MATCHES_EMPTY_STATE_CLASS}>
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
      <div className={DASHBOARD_MATCHES_EMPTY_STATE_CLASS}>
        <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="font-display text-xl tracking-wide text-foreground">
          No matches in the next {UPCOMING_HORIZON_DAYS} days
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Check back when new fixtures fall inside the {UPCOMING_HORIZON_DAYS}
          -day window.
        </p>
      </div>
    ) : showMatchSections ? (
      <>
        <div className="lg:hidden">{renderMobileMatchGrid(lifecycleBuckets)}</div>
        <div className="hidden lg:block">{renderDesktopMatchGrid()}</div>
      </>
    ) : null}
    </div>
  )
}
