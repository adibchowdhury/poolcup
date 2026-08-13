'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { HeaderChatButton } from '@/components/dashboard/header-chat-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { useAuth } from '@/src/lib/auth-context'
import {
  DISCOVER_PAGE_SIZE,
  DISCOVER_SPORT_FILTERS,
  DISCOVER_TRENDING_LIMIT,
  discoverCompetitionOptions,
  fetchDiscoverOfficialPools,
  fetchDiscoverUpcomingCompetitions,
  fetchTrendingOfficialPools,
  filterDiscoverPools,
  formatDiscoverStatus,
  joinPublicPool,
  type DiscoverPoolCard,
  type DiscoverSportFilterId,
  type DiscoverTrendingPool,
  type DiscoverUpcomingCompetition,
} from '@/src/lib/fetch-discover'
import { capturePostHog } from '@/src/lib/posthog-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { formatSportingEventDateRange } from '@/src/lib/current-event'
import { supabase } from '@/src/lib/supabase'
import { trackEvent } from '@/src/lib/track'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

function PoolCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <ShimmerBlock className="h-4 w-2/3 rounded" />
      <ShimmerBlock className="mt-3 h-3 w-1/2 rounded" />
      <ShimmerBlock className="mt-4 h-9 w-full rounded-lg" />
    </div>
  )
}

function DiscoverPoolCardView({
  pool,
  joining,
  joinDisabled,
  joinError,
  badge,
  onJoin,
}: {
  pool: DiscoverPoolCard | DiscoverTrendingPool
  joining: boolean
  joinDisabled: boolean
  joinError?: string
  badge?: string | null
  onJoin: () => void
}) {
  const status = formatDiscoverStatus(pool.eventStatus, pool.eventStartDate)
  const recentJoins =
    'recentJoins' in pool && typeof pool.recentJoins === 'number'
      ? pool.recentJoins
      : null

  return (
    <article className="flex h-full flex-col rounded-2xl border border-border/80 bg-card/80 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg tracking-wide text-foreground">
            {pool.name}
          </h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {pool.sportLabel}
            <span className="mx-1.5 text-border" aria-hidden>
              ·
            </span>
            {pool.eventName}
          </p>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/40 px-2 py-0.5 font-medium text-foreground/90">
          {pool.scoringLabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {pool.memberCount} joined
        </span>
        {recentJoins != null && recentJoins > 0 ? (
          <span className="text-primary">{recentJoins} this week</span>
        ) : null}
        {status.kind !== 'none' && status.label ? (
          <span
            className={cn(
              status.kind === 'live' && 'font-semibold text-primary',
            )}
          >
            {status.label}
          </span>
        ) : null}
      </div>

      {pool.host ? (
        <div className="mt-3 flex items-center gap-2">
          <UserProfileLink
            userId={pool.host.userId}
            ariaLabel={`${pool.host.displayName}'s profile`}
            className={cn('shrink-0 rounded-full', FOCUS_VISIBLE_RING)}
          >
            <UserAvatarImage
              avatar={pool.host.avatar}
              customAvatarUrl={pool.host.customAvatarUrl}
              alt={pool.host.displayName}
              className="h-8 w-8"
            />
          </UserProfileLink>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Host
            </p>
            <UserProfileLink
              userId={pool.host.userId}
              className={cn(
                'block truncate text-sm font-medium text-foreground hover:underline',
                FOCUS_VISIBLE_RING,
              )}
            >
              {pool.host.displayName}
            </UserProfileLink>
          </div>
        </div>
      ) : null}

      {joinError ? (
        <p className="mt-2 text-xs text-destructive">{joinError}</p>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-4">
        {pool.isMember ? (
          <>
            <Button asChild className={cn('w-full', FOCUS_VISIBLE_RING)}>
              <Link href={`/pool/${pool.inviteCode}`}>Open pool</Link>
            </Button>
            {pool.inviteCode ? (
              <Button
                type="button"
                variant="outline"
                className={cn('w-full', FOCUS_VISIBLE_RING)}
                onClick={() => {
                  const url = `${window.location.origin}/join/${pool.inviteCode}`
                  void import('@/src/lib/share-client').then(({ shareOrCopy }) => {
                    void import('@/src/lib/posthog-client').then(
                      ({ capturePostHog }) => {
                        capturePostHog('share_card_generated', {
                          type: 'pool_invite',
                        })
                      },
                    )
                    void shareOrCopy({
                      title: `Join ${pool.name} on PoolCup`,
                      text: 'Join this prediction pool on PoolCup',
                      url,
                      imageUrl: `/api/share/pool/${encodeURIComponent(pool.inviteCode)}`,
                      type: 'pool_invite',
                    }).catch(() => {
                      void navigator.clipboard.writeText(url)
                    })
                  })
                }}
              >
                Share invite
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            type="button"
            className={cn('w-full', FOCUS_VISIBLE_RING)}
            disabled={joining || joinDisabled || !pool.inviteCode}
            onClick={onJoin}
          >
            {joining ? 'Joining…' : 'Join'}
          </Button>
        )}
      </div>
    </article>
  )
}

export function DiscoverPageView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const email = user?.email ?? ''

  const [pools, setPools] = useState<DiscoverPoolCard[]>([])
  const [trending, setTrending] = useState<DiscoverTrendingPool[]>([])
  const [upcoming, setUpcoming] = useState<DiscoverUpcomingCompetition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sportId, setSportId] = useState<DiscoverSportFilterId>('all')
  const [eventId, setEventId] = useState<string | null>(
    () => searchParams.get('event')?.trim() || null,
  )
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(DISCOVER_PAGE_SIZE)
  const [joiningPoolId, setJoiningPoolId] = useState<string | null>(null)
  const [joinErrorByPool, setJoinErrorByPool] = useState<Record<string, string>>(
    {},
  )
  const viewedRef = useRef(false)
  const searchTrackedRef = useRef('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?next=/discover')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 250)
    return () => window.clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)

    const [official, trend] = await Promise.all([
      fetchDiscoverOfficialPools(supabase, userId),
      fetchTrendingOfficialPools(supabase, userId, DISCOVER_TRENDING_LIMIT),
    ])

    if (official.error && official.pools.length === 0) {
      setPools([])
      setTrending([])
      setUpcoming([])
      setError(official.error)
      setLoading(false)
      return
    }

    setPools(official.pools)
    setTrending(trend.pools)
    if (trend.error && !official.error) {
      // Trending is optional — don't block the page.
      console.error('trending:', trend.error)
    }

    const comps = await fetchDiscoverUpcomingCompetitions(
      supabase,
      userId,
      official.pools,
    )
    setUpcoming(comps.events)
    setError(null)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (loading || error || !userId || viewedRef.current) return
    viewedRef.current = true
    capturePostHog('discover_viewed', {
      pool_count: pools.length,
      trending_count: trending.length,
    })
  }, [loading, error, userId, pools.length, trending.length])

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q || q === searchTrackedRef.current) return
    searchTrackedRef.current = q
    capturePostHog('discover_search', { query: q, query_length: q.length })
  }, [debouncedQuery])

  const competitions = useMemo(
    () => discoverCompetitionOptions(pools, sportId),
    [pools, sportId],
  )

  const filtered = useMemo(
    () =>
      filterDiscoverPools(pools, {
        sportId,
        eventId,
        query: debouncedQuery,
      }),
    [pools, sportId, eventId, debouncedQuery],
  )

  const visiblePools = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  function setSportAndTrack(next: DiscoverSportFilterId) {
    if (next === sportId) return
    setSportId(next)
    setEventId(null)
    setVisibleCount(DISCOVER_PAGE_SIZE)
    capturePostHog('discover_filter_changed', {
      filter: 'sport',
      sport_id: next,
    })
  }

  function setEventAndTrack(next: string | null) {
    if (next === eventId) return
    setEventId(next)
    setVisibleCount(DISCOVER_PAGE_SIZE)
    capturePostHog('discover_filter_changed', {
      filter: 'competition',
      event_id: next,
    })
  }

  async function handleJoin(pool: DiscoverPoolCard) {
    if (!userId || joiningPoolId) return

    setJoiningPoolId(pool.id)
    setJoinErrorByPool((prev) => {
      const next = { ...prev }
      delete next[pool.id]
      return next
    })

    trackEvent('join_started', {
      poolId: pool.id,
      userId,
      metadata: { via: 'discover' },
    })

    const { error: joinError, alreadyMember } = await joinPublicPool(
      supabase,
      { id: userId, email },
      pool.id,
    )

    if (joinError) {
      setJoinErrorByPool((prev) => ({ ...prev, [pool.id]: joinError }))
      setJoiningPoolId(null)
      return
    }

    trackEvent('join_completed', {
      poolId: pool.id,
      userId,
      metadata: { via: 'discover', already_member: alreadyMember },
    })

    if (!alreadyMember) {
      capturePostHog('pool_joined', {
        pool_id: pool.id,
        via: 'official',
      })
    }

    const markMember = (list: DiscoverPoolCard[]) =>
      list.map((p) =>
        p.id === pool.id
          ? {
              ...p,
              isMember: true,
              memberCount: alreadyMember ? p.memberCount : p.memberCount + 1,
            }
          : p,
      )

    setPools((prev) => markMember(prev))
    setTrending((prev) => markMember(prev) as DiscoverTrendingPool[])
    setJoiningPoolId(null)
    router.push(`/pool/${pool.inviteCode}`)
  }

  if (authLoading || !userId) {
    return (
      <main
        className={cn(
          'flex min-h-screen items-center justify-center bg-app-background',
          MOBILE_BOTTOM_NAV_PAD_CLASS,
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <div
      className={cn('min-h-screen bg-app-background', MOBILE_BOTTOM_NAV_PAD_CLASS)}
    >
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-app-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard?tab=dashboard"
            className={cn(
              'rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              FOCUS_VISIBLE_RING,
            )}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Explore
            </p>
            <h1 className="font-display text-xl tracking-wide text-foreground sm:text-2xl">
              Discover
            </h1>
          </div>
          <HeaderChatButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:py-8">
        {/* Filters + search */}
        <section className="space-y-3" aria-label="Discover filters">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setVisibleCount(DISCOVER_PAGE_SIZE)
              }}
              placeholder="Search pools or competitions…"
              className={cn('h-11 pl-9', FOCUS_VISIBLE_RING)}
              aria-label="Search official pools and competitions"
            />
          </div>

          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="list"
            aria-label="Sport filter"
          >
            {DISCOVER_SPORT_FILTERS.map((sport) => {
              const selected = sport.id === sportId
              return (
                <button
                  key={sport.id}
                  type="button"
                  role="listitem"
                  aria-pressed={selected}
                  onClick={() => setSportAndTrack(sport.id)}
                  className={cn(
                    'shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                    FOCUS_VISIBLE_RING,
                    selected
                      ? 'border-primary bg-primary font-semibold text-primary-foreground'
                      : 'border-border/70 bg-transparent text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {sport.label}
                </button>
              )
            })}
          </div>

          {competitions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="discover-competition" className="sr-only">
                Competition
              </label>
              <select
                id="discover-competition"
                value={eventId ?? ''}
                onChange={(e) =>
                  setEventAndTrack(e.target.value ? e.target.value : null)
                }
                className={cn(
                  'h-10 max-w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground',
                  FOCUS_VISIBLE_RING,
                )}
              >
                <option value="">All competitions</option>
                {competitions.map((c) => (
                  <option key={c.eventId} value={c.eventId}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </section>

        {loading ? (
          <div className="space-y-8" aria-busy="true" aria-label="Loading discover">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <PoolCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : error && pools.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-10 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              type="button"
              variant="outline"
              className={cn('mt-4', FOCUS_VISIBLE_RING)}
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            {/* Trending */}
            {trending.length > 0 ? (
              <section className="space-y-3" aria-labelledby="discover-trending">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
                  <h2
                    id="discover-trending"
                    className="font-display text-2xl tracking-wide text-foreground"
                  >
                    Trending
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ranked by joins in the last 7 days
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {trending.map((pool) => (
                    <DiscoverPoolCardView
                      key={`trend-${pool.id}`}
                      pool={pool}
                      badge="Hot"
                      joining={joiningPoolId === pool.id}
                      joinDisabled={joiningPoolId != null}
                      joinError={joinErrorByPool[pool.id]}
                      onJoin={() => void handleJoin(pool)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Upcoming competitions */}
            {upcoming.length > 0 ? (
              <section className="space-y-3" aria-labelledby="discover-upcoming">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" aria-hidden />
                  <h2
                    id="discover-upcoming"
                    className="font-display text-2xl tracking-wide text-foreground"
                  >
                    Upcoming competitions
                  </h2>
                </div>
                <ul className="space-y-2">
                  {upcoming.map((event) => (
                    <li
                      key={event.eventId}
                      className="rounded-2xl border border-border/80 bg-card/70 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {event.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {event.sportLabel}
                            <span className="mx-1.5" aria-hidden>
                              ·
                            </span>
                            {event.status === 'live' ? 'Live' : 'Upcoming'}
                            {event.startDate || event.endDate ? (
                              <>
                                <span className="mx-1.5" aria-hidden>
                                  ·
                                </span>
                                {formatSportingEventDateRange(
                                  event.startDate,
                                  event.endDate,
                                )}
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      {event.officialPools.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {event.officialPools.map((pool) => (
                            <Link
                              key={pool.id}
                              href={
                                pool.isMember
                                  ? `/pool/${pool.inviteCode}`
                                  : `/discover?event=${event.eventId}`
                              }
                              onClick={() => {
                                if (!pool.isMember) {
                                  setEventId(event.eventId)
                                  setVisibleCount(DISCOVER_PAGE_SIZE)
                                }
                              }}
                              className={cn(
                                'rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20',
                                FOCUS_VISIBLE_RING,
                              )}
                            >
                              {pool.isMember ? 'Open' : 'View'} {pool.name}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Official pool coming soon
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Official pools list */}
            <section className="space-y-3" aria-labelledby="discover-official">
              <h2
                id="discover-official"
                className="font-display text-2xl tracking-wide text-foreground"
              >
                Official pools
              </h2>

              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center">
                  {pools.length === 0 ? (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        No official pools yet
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Official PoolCup pools will show up here when they launch.
                        You can still create your own invite-only pool.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button asChild className={FOCUS_VISIBLE_RING}>
                          <Link href="/create">Create a pool</Link>
                        </Button>
                        <Button asChild variant="outline" className={FOCUS_VISIBLE_RING}>
                          <Link href="/dashboard">Back to home</Link>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        No official pools match your filters
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Try another sport, clear search, or browse all
                        competitions.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className={FOCUS_VISIBLE_RING}
                          onClick={() => {
                            setSportId('all')
                            setEventId(null)
                            setQuery('')
                            setVisibleCount(DISCOVER_PAGE_SIZE)
                            capturePostHog('discover_filter_changed', {
                              filter: 'reset',
                            })
                          }}
                        >
                          Clear filters
                        </Button>
                        <Button asChild className={FOCUS_VISIBLE_RING}>
                          <Link href="/create">Create a pool</Link>
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} pool{filtered.length === 1 ? '' : 's'}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visiblePools.map((pool) => (
                      <DiscoverPoolCardView
                        key={pool.id}
                        pool={pool}
                        joining={joiningPoolId === pool.id}
                        joinDisabled={joiningPoolId != null}
                        joinError={joinErrorByPool[pool.id]}
                        onJoin={() => void handleJoin(pool)}
                      />
                    ))}
                  </div>
                  {hasMore ? (
                    <div className="flex justify-center pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className={FOCUS_VISIBLE_RING}
                        onClick={() =>
                          setVisibleCount((n) => n + DISCOVER_PAGE_SIZE)
                        }
                      >
                        Load more
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
