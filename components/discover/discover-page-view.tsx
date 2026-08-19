'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react'
import { DashboardAppShell } from '@/components/dashboard/dashboard-app-shell'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import {
  DISCOVER_SECTION_CAP,
  DISCOVER_SECTION_PAGE_SIZE,
  DISCOVER_SPORT_FILTERS,
  discoverSectionTitle,
  discoverSportSectionKey,
  fetchDiscoverSearchCorpus,
  fetchDiscoverSectionAll,
  fetchDiscoverSections,
  filterDiscoverPoolsByQuery,
  joinPublicPool,
  markPoolJoinedInList,
  sortDiscoverPoolsOfficialFirst,
  type DiscoverPoolCard,
  type DiscoverSectionKey,
  type DiscoverSectionsPayload,
  type DiscoverSportId,
} from '@/src/lib/fetch-discover'
import { capturePostHog } from '@/src/lib/posthog-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { sportIconPng } from '@/src/lib/sport-display'
import { supabase } from '@/src/lib/supabase'
import { trackEvent } from '@/src/lib/track'
import { cn } from '@/lib/utils'

/** Discover official-card sport labels (soccer → Soccer, not Football). */
function discoverSportLabel(sport: string | null | undefined): string {
  const key = (sport ?? '').trim().toLowerCase()
  if (key === 'soccer' || key === 'football') return 'Soccer'
  if (key === 'basketball') return 'Basketball'
  if (key === 'american_football' || key === 'nfl') return 'American Football'
  if (key === 'hockey' || key === 'nhl') return 'Hockey'
  if (key === 'baseball' || key === 'mlb') return 'Baseball'
  if (!key) return 'Sport'
  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const emptySections = (): DiscoverSectionsPayload => ({
  official: [],
  public: [],
  trending: [],
  bySport: [],
})

function PoolCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card/60 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.2)]',
        className,
      )}
    >
      <div className="flex gap-3">
        <ShimmerBlock className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <ShimmerBlock className="h-4 w-2/3 rounded" />
          <ShimmerBlock className="h-3 w-1/2 rounded" />
        </div>
      </div>
      <ShimmerBlock className="mt-3 h-9 w-full rounded-lg" />
    </div>
  )
}

function SectionHeader({
  id,
  title,
  subtitle,
  onSeeAll,
}: {
  id: string
  title: string
  subtitle?: string
  onSeeAll?: () => void
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2
          id={id}
          className="font-display text-2xl tracking-wide text-foreground"
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className={cn(
            'shrink-0 rounded-md text-sm font-semibold text-primary transition-colors hover:underline',
            FOCUS_VISIBLE_RING,
          )}
        >
          See all
        </button>
      ) : null}
    </div>
  )
}

function HorizontalScroller({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        '@container min-w-0 max-w-full w-full overflow-x-auto overscroll-x-contain',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'snap-x snap-mandatory',
        className,
      )}
      role="list"
      aria-label={label}
    >
      {children}
    </div>
  )
}

function SportIconThumb({
  sport,
  className,
  size = 48,
}: {
  sport: string | null
  className?: string
  size?: number
}) {
  const png = sport ? sportIconPng(sport) : null
  return (
    <div
      className={cn('relative flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {png ? (
        <Image
          src={`/sports/${png}`}
          alt=""
          width={size}
          height={size}
          className="size-full object-contain"
        />
      ) : (
        <Shield className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  )
}

function SportFilterRow({
  selected,
  onSelect,
}: {
  selected: DiscoverSportId | null
  onSelect: (sport: DiscoverSportId) => void
}) {
  return (
    <div
      className={cn(
        'min-w-0 max-w-full overflow-x-auto overscroll-x-contain',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
      role="listbox"
      aria-label="Filter by sport"
      aria-orientation="horizontal"
    >
      <div className="flex w-max gap-2 pb-0.5 sm:gap-3">
        {DISCOVER_SPORT_FILTERS.map((sport) => {
          const isSelected = selected === sport.id
          return (
            <button
              key={sport.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={
                isSelected
                  ? `${sport.label}, selected. Tap to show all sports`
                  : `Filter by ${sport.label}`
              }
              onClick={() => onSelect(sport.id)}
              className={cn(
                'flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1.5 py-2 transition-colors sm:w-20',
                FOCUS_VISIBLE_RING,
                isSelected
                  ? 'bg-primary/15 shadow-[0_0_0_1.5px_var(--primary)]'
                  : 'hover:bg-muted/50',
              )}
            >
              <span
                className={cn(
                  'flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border bg-card shadow-[0_4px_12px_rgba(0,0,0,0.18)]',
                  isSelected ? 'border-primary/50' : 'border-border/70',
                )}
              >
                <Image
                  src={`/sports/${sport.iconPng}`}
                  alt=""
                  width={36}
                  height={36}
                  className="object-contain p-0.5"
                />
              </span>
              <span
                className={cn(
                  'w-full truncate text-center text-[11px] font-medium leading-tight text-foreground sm:text-xs',
                  isSelected && 'font-semibold',
                )}
              >
                {sport.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DiscoverPoolCardView({
  pool,
  joining,
  joinDisabled,
  joinError,
  onJoin,
  compact,
  /** Official section: sport ball icon + stacked (no clip) text. */
  officialLayout,
}: {
  pool: DiscoverPoolCard
  joining: boolean
  joinDisabled: boolean
  joinError?: string
  onJoin: () => void
  /** Narrower card for horizontal rows. */
  compact?: boolean
  officialLayout?: boolean
}) {
  const useOfficial = Boolean(officialLayout || pool.isOfficial)

  return (
    <article
      role="listitem"
      className={cn(
        'flex min-h-0 flex-col rounded-2xl border border-border/70 bg-card/80 p-3',
        'shadow-[0_8px_24px_rgba(0,0,0,0.18)]',
        // Official 2×2 cells: allow height to grow with stacked content (no clip).
        useOfficial && !compact
          ? 'min-w-0 overflow-visible'
          : 'h-full overflow-hidden',
        compact ? 'w-[min(17.5rem,78vw)] shrink-0 snap-start' : 'min-w-0',
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'font-display tracking-wide text-foreground',
              useOfficial
                ? 'line-clamp-2 break-words text-sm leading-snug sm:text-base'
                : 'truncate text-base sm:text-lg',
            )}
            title={pool.name}
          >
            {pool.name}
          </h3>
          <div className="mt-1 space-y-0.5 text-xs leading-snug text-muted-foreground">
            {useOfficial ? (
              <p className="break-words">{discoverSportLabel(pool.sport)}</p>
            ) : null}
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="tabular-nums">{pool.memberCount} joined</span>
            </p>
          </div>
        </div>
        {useOfficial ? (
          <SportIconThumb sport={pool.sport} size={compact ? 28 : 32} />
        ) : (
          <PoolAvatarImage
            avatar={pool.avatar}
            emblemUrl={pool.emblemUrl}
            size="sm"
            pixelSize={compact ? 40 : 48}
            className="rounded-xl"
          />
        )}
      </div>

      {joinError ? (
        <p className="mt-2 break-words text-xs text-destructive">{joinError}</p>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-3">
        {pool.isMember ? (
          <Button
            asChild
            size="sm"
            className={cn('w-full', FOCUS_VISIBLE_RING)}
            disabled={!pool.inviteCode}
          >
            <Link href={`/pool/${pool.inviteCode}`}>Open pool</Link>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
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

function TrendingPoolRow({
  pool,
  rank,
  joining,
  joinDisabled,
  joinError,
  onJoin,
}: {
  pool: DiscoverPoolCard
  rank: number
  joining: boolean
  joinDisabled: boolean
  joinError?: string
  onJoin: () => void
}) {
  return (
    <article
      role="listitem"
      className={cn(
        'flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border/70 bg-card/80 px-3 py-3 sm:flex-nowrap sm:gap-4 sm:px-4',
        'shadow-[0_8px_24px_rgba(0,0,0,0.18)]',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        <span
          className="w-6 shrink-0 text-center font-display text-lg tabular-nums text-primary sm:w-7 sm:text-xl"
          aria-label={`Rank ${rank}`}
        >
          {rank}
        </span>
        <SportIconThumb sport={pool.sport} size={28} />
        <div className="min-w-0 flex-1">
          <h3
            className="line-clamp-2 break-words font-display text-sm tracking-wide text-foreground sm:text-base"
            title={pool.name}
          >
            {pool.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {discoverSportLabel(pool.sport)}
          </p>
          {joinError ? (
            <p className="mt-1 break-words text-xs text-destructive">{joinError}</p>
          ) : null}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2.5 sm:gap-3">
        <p className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground sm:text-sm">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{pool.memberCount}</span>
        </p>
        {pool.isMember ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            className={cn('shrink-0', FOCUS_VISIBLE_RING)}
            disabled={!pool.inviteCode}
          >
            <Link href={`/pool/${pool.inviteCode}`}>Open</Link>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className={cn('shrink-0', FOCUS_VISIBLE_RING)}
            disabled={joining || joinDisabled || !pool.inviteCode}
            onClick={onJoin}
          >
            {joining ? '…' : 'Join'}
          </Button>
        )}
      </div>
    </article>
  )
}

export type DiscoverPageViewProps = {
  userId: string
  email: string
  displayName?: string | null
  avatar?: string | null
  customAvatarUrl?: string | null
}

export function DiscoverPageView({
  userId,
  email,
  displayName,
  avatar,
  customAvatarUrl,
}: DiscoverPageViewProps) {
  const router = useRouter()

  const [sections, setSections] = useState<DiscoverSectionsPayload>(emptySections)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joiningPoolId, setJoiningPoolId] = useState<string | null>(null)
  const [joinErrorByPool, setJoinErrorByPool] = useState<Record<string, string>>(
    {},
  )

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchCorpus, setSearchCorpus] = useState<DiscoverPoolCard[] | null>(
    null,
  )
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [selectedSport, setSelectedSport] = useState<DiscoverSportId | null>(
    null,
  )
  const [sportPools, setSportPools] = useState<DiscoverPoolCard[]>([])
  const [sportLoading, setSportLoading] = useState(false)
  const [sportLoadingMore, setSportLoadingMore] = useState(false)
  const [sportError, setSportError] = useState<string | null>(null)
  const [sportHasMore, setSportHasMore] = useState(false)

  const [seeAllSection, setSeeAllSection] = useState<DiscoverSectionKey | null>(
    null,
  )
  const [seeAllPools, setSeeAllPools] = useState<DiscoverPoolCard[]>([])
  const [seeAllLoading, setSeeAllLoading] = useState(false)
  const [seeAllLoadingMore, setSeeAllLoadingMore] = useState(false)
  const [seeAllError, setSeeAllError] = useState<string | null>(null)
  const [seeAllHasMore, setSeeAllHasMore] = useState(false)

  const viewedRef = useRef(false)
  const searchTrackedRef = useRef('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 250)
    return () => window.clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { sections: next, error: fetchError } = await fetchDiscoverSections(
      supabase,
      userId,
      DISCOVER_SECTION_CAP,
    )

    setSections(next)
    setError(fetchError)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const hasAnyPools = useMemo(() => {
    if (sections.official.length > 0) return true
    if (sections.public.length > 0) return true
    if (sections.trending.length > 0) return true
    return false
  }, [sections])

  const searchActive = debouncedQuery.trim().length > 0
  const sportFilterActive = selectedSport != null && !searchActive

  useEffect(() => {
    if (!userId || !searchActive) {
      setSearchLoading(false)
      setSearchError(null)
      return
    }

    let cancelled = false

    async function ensureCorpus() {
      if (searchCorpus) return
      setSearchLoading(true)
      setSearchError(null)
      const { pools, error: fetchError } = await fetchDiscoverSearchCorpus(
        supabase,
        userId!,
      )
      if (cancelled) return
      setSearchCorpus(pools)
      setSearchError(fetchError)
      setSearchLoading(false)
    }

    void ensureCorpus()
    return () => {
      cancelled = true
    }
  }, [userId, searchActive, searchCorpus])

  const loadSportFilter = useCallback(
    async (sport: DiscoverSportId) => {
      if (!userId) return
      setSportLoading(true)
      setSportError(null)
      setSportPools([])
      setSportHasMore(false)

      const { pools, error: fetchError } = await fetchDiscoverSectionAll(
        supabase,
        userId,
        discoverSportSectionKey(sport),
        { limit: DISCOVER_SECTION_PAGE_SIZE, offset: 0 },
      )

      setSportPools(sortDiscoverPoolsOfficialFirst(pools))
      setSportHasMore(pools.length >= DISCOVER_SECTION_PAGE_SIZE)
      setSportError(fetchError)
      setSportLoading(false)
    },
    [userId],
  )

  useEffect(() => {
    if (!userId || !selectedSport || searchActive) {
      if (!selectedSport) {
        setSportPools([])
        setSportError(null)
        setSportHasMore(false)
        setSportLoading(false)
      }
      return
    }

    let cancelled = false

    void (async () => {
      setSportLoading(true)
      setSportError(null)
      setSportPools([])
      setSportHasMore(false)

      const { pools, error: fetchError } = await fetchDiscoverSectionAll(
        supabase,
        userId,
        discoverSportSectionKey(selectedSport),
        { limit: DISCOVER_SECTION_PAGE_SIZE, offset: 0 },
      )

      if (cancelled) return
      setSportPools(sortDiscoverPoolsOfficialFirst(pools))
      setSportHasMore(pools.length >= DISCOVER_SECTION_PAGE_SIZE)
      setSportError(fetchError)
      setSportLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [userId, selectedSport, searchActive])

  const searchResults = useMemo(() => {
    if (!searchActive || !searchCorpus) return []
    return filterDiscoverPoolsByQuery(searchCorpus, debouncedQuery)
  }, [searchActive, searchCorpus, debouncedQuery])

  useEffect(() => {
    if (loading || error || !userId || viewedRef.current) return
    viewedRef.current = true
    capturePostHog('discover_viewed', {
      official_count: sections.official.length,
      public_count: sections.public.length,
      trending_count: sections.trending.length,
    })
  }, [loading, error, userId, sections])

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q || q === searchTrackedRef.current) return
    searchTrackedRef.current = q
    capturePostHog('discover_search', { has_query: true })
  }, [debouncedQuery])

  function toggleSportFilter(sport: DiscoverSportId) {
    setSelectedSport((prev) => {
      if (prev === sport) return null
      capturePostHog('discover_sport_filter_selected', { sport })
      return sport
    })
  }

  const loadMoreSport = useCallback(async () => {
    if (
      !userId ||
      !selectedSport ||
      sportLoadingMore ||
      !sportHasMore ||
      searchActive
    ) {
      return
    }
    setSportLoadingMore(true)
    setSportError(null)

    const { pools, error: fetchError } = await fetchDiscoverSectionAll(
      supabase,
      userId,
      discoverSportSectionKey(selectedSport),
      {
        limit: DISCOVER_SECTION_PAGE_SIZE,
        offset: sportPools.length,
      },
    )

    if (fetchError) {
      setSportError(fetchError)
      setSportLoadingMore(false)
      return
    }

    setSportPools((prev) => {
      const seen = new Set(prev.map((p) => p.id))
      const merged = [...prev]
      for (const pool of pools) {
        if (!seen.has(pool.id)) merged.push(pool)
      }
      return sortDiscoverPoolsOfficialFirst(merged)
    })
    setSportHasMore(pools.length >= DISCOVER_SECTION_PAGE_SIZE)
    setSportLoadingMore(false)
  }, [
    userId,
    selectedSport,
    sportLoadingMore,
    sportHasMore,
    searchActive,
    sportPools.length,
  ])

  const openSeeAll = useCallback(
    async (section: DiscoverSectionKey) => {
      if (!userId) return
      capturePostHog('discover_section_see_all_clicked', { section })
      setSeeAllSection(section)
      setSeeAllPools([])
      setSeeAllError(null)
      setSeeAllHasMore(false)
      setSeeAllLoading(true)

      const { pools, error: fetchError } = await fetchDiscoverSectionAll(
        supabase,
        userId,
        section,
        { limit: DISCOVER_SECTION_PAGE_SIZE, offset: 0 },
      )

      setSeeAllPools(pools)
      setSeeAllHasMore(pools.length >= DISCOVER_SECTION_PAGE_SIZE)
      setSeeAllError(fetchError)
      setSeeAllLoading(false)
    },
    [userId],
  )

  const loadMoreSeeAll = useCallback(async () => {
    if (!userId || !seeAllSection || seeAllLoadingMore || !seeAllHasMore) return
    setSeeAllLoadingMore(true)
    setSeeAllError(null)

    const { pools, error: fetchError } = await fetchDiscoverSectionAll(
      supabase,
      userId,
      seeAllSection,
      {
        limit: DISCOVER_SECTION_PAGE_SIZE,
        offset: seeAllPools.length,
      },
    )

    if (fetchError) {
      setSeeAllError(fetchError)
      setSeeAllLoadingMore(false)
      return
    }

    setSeeAllPools((prev) => {
      const seen = new Set(prev.map((p) => p.id))
      const merged = [...prev]
      for (const pool of pools) {
        if (!seen.has(pool.id)) merged.push(pool)
      }
      return merged
    })
    setSeeAllHasMore(pools.length >= DISCOVER_SECTION_PAGE_SIZE)
    setSeeAllLoadingMore(false)
  }, [
    userId,
    seeAllSection,
    seeAllLoadingMore,
    seeAllHasMore,
    seeAllPools.length,
  ])

  function markJoinedEverywhere(poolId: string, alreadyMember: boolean) {
    const mark = (list: DiscoverPoolCard[]) =>
      markPoolJoinedInList(list, poolId, alreadyMember)

    setSections((prev) => ({
      official: mark(prev.official),
      public: mark(prev.public),
      trending: mark(prev.trending),
      bySport: prev.bySport.map((b) => ({
        ...b,
        pools: mark(b.pools),
      })),
    }))
    setSeeAllPools((prev) => mark(prev))
    setSearchCorpus((prev) => (prev ? mark(prev) : prev))
    setSportPools((prev) => mark(prev))
  }

  async function handleJoin(pool: DiscoverPoolCard) {
    if (joiningPoolId) return

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
        via: 'discover',
      })
    }

    markJoinedEverywhere(pool.id, alreadyMember)
    setJoiningPoolId(null)
    if (pool.inviteCode) {
      router.push(`/pool/${pool.inviteCode}`)
    }
  }

  const joinProps = (pool: DiscoverPoolCard) => ({
    joining: joiningPoolId === pool.id,
    joinDisabled: joiningPoolId != null,
    joinError: joinErrorByPool[pool.id],
    onJoin: () => void handleJoin(pool),
  })

  return (
    <DashboardAppShell
      userId={userId}
      email={email}
      displayName={displayName}
      avatar={avatar}
      customAvatarUrl={customAvatarUrl}
      hubActiveNav="discover"
      mainClassName="min-w-0 max-w-5xl overflow-x-clip"
    >
      <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pools or competitions…"
            className={cn('h-11 pl-9', FOCUS_VISIBLE_RING)}
            aria-label="Search official and public pools"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <SportFilterRow
          selected={selectedSport}
          onSelect={toggleSportFilter}
        />
      </div>

      {loading ? (
          <div className="space-y-10" aria-busy="true" aria-label="Loading discover">
            <div className="space-y-3">
              <ShimmerBlock className="h-7 w-40 rounded" />
              <div
                className={cn(
                  '@container min-w-0 overflow-x-auto',
                  '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                )}
              >
                <div
                  className="grid grid-flow-col grid-rows-2 gap-2.5"
                  style={{
                    gridAutoColumns: 'calc((100cqw - 0.625rem) / 2)',
                  }}
                >
                  {Array.from({ length: 4 }).map((_, i) => (
                    <PoolCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <ShimmerBlock className="h-7 w-36 rounded" />
              <div className="flex gap-3 overflow-hidden">
                <PoolCardSkeleton className="w-[17.5rem] shrink-0" />
                <PoolCardSkeleton className="w-[17.5rem] shrink-0" />
              </div>
            </div>
          </div>
        ) : error && !hasAnyPools ? (
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
        ) : searchActive ? (
          <section
            className="min-w-0 space-y-3"
            aria-labelledby="discover-search-results"
            aria-busy={searchLoading}
          >
            <div>
              <h2
                id="discover-search-results"
                className="font-display text-2xl tracking-wide text-foreground"
              >
                Search results
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Official and public pools matching your search
              </p>
            </div>

            {searchLoading && !searchCorpus ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <PoolCardSkeleton key={i} />
                ))}
              </div>
            ) : searchError && searchResults.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card/70 px-4 py-8 text-center">
                <p className="text-sm text-destructive">{searchError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className={cn('mt-4', FOCUS_VISIBLE_RING)}
                  onClick={() => {
                    setSearchCorpus(null)
                    setSearchError(null)
                  }}
                >
                  Try again
                </Button>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  No pools match that search
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Try another name, or clear the search to browse sections.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className={cn('mt-4', FOCUS_VISIBLE_RING)}
                  onClick={() => setQuery('')}
                >
                  Clear search
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {searchResults.map((pool) => (
                  <DiscoverPoolCardView
                    key={`search-${pool.id}`}
                    pool={pool}
                    officialLayout={pool.isOfficial}
                    {...joinProps(pool)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : sportFilterActive && selectedSport ? (
          <section
            className="min-w-0 space-y-3"
            aria-labelledby="discover-sport-filter"
            aria-busy={sportLoading}
          >
            <div>
              <h2
                id="discover-sport-filter"
                className="font-display text-2xl tracking-wide text-foreground"
              >
                {
                  DISCOVER_SPORT_FILTERS.find((s) => s.id === selectedSport)
                    ?.label
                }
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Pools for this sport · official first
              </p>
            </div>

            {sportLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <PoolCardSkeleton key={i} />
                ))}
              </div>
            ) : sportError && sportPools.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card/70 px-4 py-8 text-center">
                <p className="text-sm text-destructive">{sportError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className={cn('mt-4', FOCUS_VISIBLE_RING)}
                  onClick={() => void loadSportFilter(selectedSport)}
                >
                  Try again
                </Button>
              </div>
            ) : sportPools.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  No pools for this sport yet
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Tap the sport again to clear the filter and browse all
                  sections.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sportPools.map((pool) => (
                    <DiscoverPoolCardView
                      key={`sport-filter-${pool.id}`}
                      pool={pool}
                      officialLayout={pool.isOfficial}
                      {...joinProps(pool)}
                    />
                  ))}
                </div>
                {sportHasMore ? (
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={FOCUS_VISIBLE_RING}
                      disabled={sportLoadingMore}
                      onClick={() => void loadMoreSport()}
                    >
                      {sportLoadingMore ? 'Loading…' : 'Load more'}
                    </Button>
                  </div>
                ) : null}
                {sportError && sportPools.length > 0 ? (
                  <p className="text-center text-xs text-destructive">
                    {sportError}
                  </p>
                ) : null}
              </>
            )}
          </section>
        ) : !hasAnyPools ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Nothing to discover yet
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Official and public pools will show up here when they launch. You
              can still create your own invite-only pool.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button asChild className={FOCUS_VISIBLE_RING}>
                <Link href="/create">Create a pool</Link>
              </Button>
              <Button asChild variant="outline" className={FOCUS_VISIBLE_RING}>
                <Link href="/dashboard">Back to home</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Official — 2×2 horizontal scroll grid */}
            {sections.official.length > 0 ? (
              <section
                className="min-w-0 space-y-3"
                aria-labelledby="discover-official"
              >
                <SectionHeader
                  id="discover-official"
                  title="Official pools"
                  subtitle="Verified PoolCup competitions"
                  onSeeAll={() => void openSeeAll('official')}
                />
                <HorizontalScroller label="Official pools">
                  <div
                    className="grid min-w-0 grid-flow-col grid-rows-2 items-stretch gap-2.5"
                    style={{
                      gridAutoColumns: 'calc((100cqw - 0.625rem) / 2)',
                    }}
                  >
                    {sections.official.map((pool) => (
                      <DiscoverPoolCardView
                        key={`official-${pool.id}`}
                        pool={pool}
                        officialLayout
                        {...joinProps(pool)}
                      />
                    ))}
                  </div>
                </HorizontalScroller>
              </section>
            ) : null}

            {/* 2. Public — single-row horizontal scroll (hide if empty) */}
            {sections.public.length > 0 ? (
              <section
                className="min-w-0 space-y-3"
                aria-labelledby="discover-public"
              >
                <SectionHeader
                  id="discover-public"
                  title="Public pools"
                  subtitle="Open pools anyone can join"
                  onSeeAll={() => void openSeeAll('public')}
                />
                <HorizontalScroller label="Public pools">
                  <div className="flex w-max gap-3 pr-1">
                    {sections.public.map((pool) => (
                      <DiscoverPoolCardView
                        key={`public-${pool.id}`}
                        pool={pool}
                        compact
                        {...joinProps(pool)}
                      />
                    ))}
                  </div>
                </HorizontalScroller>
              </section>
            ) : null}

            {/* Trending — vertical stack of standard Discover cards */}
            {sections.trending.length > 0 ? (
              <section
                className="min-w-0 space-y-3"
                aria-labelledby="discover-trending"
              >
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <TrendingUp
                        className="h-4 w-4 text-primary"
                        aria-hidden
                      />
                      <h2
                        id="discover-trending"
                        className="font-display text-2xl tracking-wide text-foreground"
                      >
                        Trending pools
                      </h2>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Ranked by recent joins
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openSeeAll('trending')}
                    className={cn(
                      'shrink-0 rounded-md text-sm font-semibold text-primary transition-colors hover:underline',
                      FOCUS_VISIBLE_RING,
                    )}
                  >
                    See all
                  </button>
                </div>
                <div className="flex flex-col gap-2.5 sm:gap-3" role="list">
                  {sections.trending.map((pool, index) => (
                    <TrendingPoolRow
                      key={`trend-${pool.id}`}
                      pool={pool}
                      rank={index + 1}
                      {...joinProps(pool)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      <Dialog
        open={seeAllSection != null}
        onOpenChange={(open) => {
          if (!open) {
            setSeeAllSection(null)
            setSeeAllPools([])
            setSeeAllError(null)
            setSeeAllHasMore(false)
          }
        }}
      >
        <DialogContent
          className={cn(
            'flex max-h-[min(92dvh,40rem)] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl',
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-4 text-left sm:px-5">
            <DialogTitle className="font-display text-xl tracking-wide">
              {seeAllSection
                ? discoverSectionTitle(seeAllSection)
                : 'Pools'}
            </DialogTitle>
            <DialogDescription>
              Browse the full list and join when you&apos;re ready.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {seeAllLoading ? (
              <div className="space-y-3" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <PoolCardSkeleton key={i} />
                ))}
              </div>
            ) : seeAllError && seeAllPools.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-destructive">{seeAllError}</p>
                {seeAllSection ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn('mt-4', FOCUS_VISIBLE_RING)}
                    onClick={() => void openSeeAll(seeAllSection)}
                  >
                    Try again
                  </Button>
                ) : null}
              </div>
            ) : seeAllPools.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No pools in this section yet.
              </p>
            ) : seeAllSection === 'trending' ? (
              <div className="flex flex-col gap-2.5" role="list">
                {seeAllPools.map((pool, index) => (
                  <TrendingPoolRow
                    key={`see-all-trend-${pool.id}`}
                    pool={pool}
                    rank={index + 1}
                    {...joinProps(pool)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {seeAllPools.map((pool) => (
                  <DiscoverPoolCardView
                    key={`see-all-${pool.id}`}
                    pool={pool}
                    officialLayout={
                      seeAllSection === 'official' || pool.isOfficial
                    }
                    {...joinProps(pool)}
                  />
                ))}
              </div>
            )}

            {seeAllHasMore && !seeAllLoading ? (
              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className={FOCUS_VISIBLE_RING}
                  disabled={seeAllLoadingMore}
                  onClick={() => void loadMoreSeeAll()}
                >
                  {seeAllLoadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            ) : null}
            {seeAllError && seeAllPools.length > 0 ? (
              <p className="mt-3 text-center text-xs text-destructive">
                {seeAllError}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardAppShell>
  )
}
