'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { useBadgeUnlockOptional } from '@/components/achievements/badge-unlock-provider'
import {
  ChevronRight,
  Pencil,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { FriendshipButton } from '@/components/friends/friendship-button'
import { UserModerationMenu } from '@/components/friends/user-moderation-menu'
import { ProfileAnalyticsEntry } from '@/components/profile/profile-analytics-entry'
import { ReportUserButton } from '@/components/profile/report-user-button'
import { cn } from '@/lib/utils'
import {
  fetchUserAchievementProgress,
  fetchUserAchievements,
  type AchievementWithStatus,
  type UserAchievementProgress,
  type UserAchievementsData,
} from '@/src/lib/fetch-user-achievements'
import {
  favoriteSportChips,
  fetchPublicProfile,
  fetchUserAchievementsReadOnly,
  type FavoriteSportChip,
} from '@/src/lib/fetch-public-profile'
import {
  fetchProfilePools,
  type ProfilePoolSummary,
  type ProfileSportSummary,
} from '@/src/lib/fetch-profile-pools'
import {
  fetchProfileRecentActivity,
  type ProfileActivityItem,
} from '@/src/lib/fetch-profile-activity'
import { pickNextAchievement } from '@/src/lib/pick-next-achievement'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'
import { sportDisplayLabel, sportIconPng } from '@/src/lib/sport-display'
import { capturePostHog } from '@/src/lib/posthog-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { getMutualFriendsCount, isUserBlocked } from '@/src/lib/friendships'
import { supabase } from '@/src/lib/supabase'
import { xpToLevel } from '@/src/lib/levels'
import {
  achievementRarityLabel,
  ACHIEVEMENT_RARITY_STYLES,
} from '@/src/lib/achievement-rarity'
import { ordinalPlace } from '@/components/pool/leaderboard-grouped-list'

export type ProfileShowcaseMode = 'self' | 'public'

type ProfileShowcaseProps = {
  userId: string
  username?: string | null
  displayName: string
  avatar: string
  customAvatarUrl: string | null
  predictionsMade: number
  accuracy: number | null
  /** Pool points (`users.points`) — career highlights. */
  totalPoints?: number | null
  exactScores?: number | null
  friendsCount?: number | null
  favoriteSports?: FavoriteSportChip[]
  /** Account created date — “Member since”. */
  createdAt?: string | null
  /**
   * Stage-2 profile title (e.g. “Bracket Architect”).
   * Slot is always rendered; chip only shows when non-empty.
   */
  profileTitle?: string | null
  /**
   * Stage-2 season label. Slot always rendered; chip only when non-empty.
   */
  seasonLabel?: string | null
  /** When false, skips client fetches (dashboard tab inactive). Default true. */
  active?: boolean
  /**
   * `self` — own dashboard profile (evaluate + edit + badge unlock).
   * `public` — any user's public page (READ-ONLY achievements, no evaluate).
   */
  mode?: ProfileShowcaseMode
  /** Self-mode edit handler (pencil). Ignored in public mode. */
  onEditProfile?: () => void
  /**
   * Public mode when viewing your own `/u/[id]`: show Edit → dashboard profile.
   */
  isOwnPublicProfile?: boolean
  /** Optional preloaded achievements (public page server fetch). */
  initialAchievements?: UserAchievementsData | null
  initialActivity?: ProfileActivityItem[]
  loadError?: string | null
  /** Peak level from users.highest_level. */
  highestLevel?: number | null
}

type CareerHighlightsData = {
  poolsWon: number
  bestFinish: number | null
  accuracy: number | null
  totalPoints: number | null
  exactScores: number
  podiums: number
}

const CAREER_HAIRLINE = 'bg-white/[0.08]'

function CareerHighlightsResume({ data }: { data: CareerHighlightsData }) {
  const hasAny =
    data.poolsWon > 0 ||
    data.bestFinish != null ||
    data.accuracy != null ||
    (data.totalPoints != null && data.totalPoints > 0) ||
    data.exactScores > 0 ||
    data.podiums > 0

  if (!hasAny) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Career milestones will appear as you compete.
      </p>
    )
  }

  const stripItems: { value: string; label: string }[] = [
    {
      value: (data.totalPoints ?? 0).toLocaleString(),
      label: 'POINTS',
    },
    {
      value: data.exactScores.toLocaleString(),
      label: 'EXACT',
    },
    {
      value: data.podiums.toLocaleString(),
      label: 'PODIUMS',
    },
  ]

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Hero — pools won (no card; subtle green glow only) */}
      <div
        data-career-hero="pools-won"
        className="relative flex flex-col items-center px-2 py-7 text-center"
      >
        <div
          className="pointer-events-none absolute left-1/2 top-[42%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_22%,transparent)_0%,transparent_70%)]"
          aria-hidden
        />
        <Trophy
          className="relative h-6 w-6 text-primary"
          aria-hidden
        />
        <p className="relative mt-2 font-mono text-6xl leading-none tabular-nums tracking-wide text-foreground sm:text-7xl">
          {data.poolsWon.toLocaleString()}
        </p>
        <p className="relative mt-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Pools Won
        </p>
        <p className="relative mt-1.5 text-[11px] text-muted-foreground">
          Your biggest achievement
        </p>
      </div>

      <div className={cn('h-px w-full', CAREER_HAIRLINE)} aria-hidden />

      {/* Best finish + Accuracy — typography only, one vertical hairline */}
      <div className="grid grid-cols-2 py-6">
        <div
          data-career-hero="best-finish"
          className="flex flex-col items-center px-3 text-center"
        >
          <p className="font-mono text-4xl leading-none tabular-nums tracking-wide text-[#ffb300] sm:text-5xl">
            {data.bestFinish != null ? `#${data.bestFinish}` : '—'}
          </p>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Best Finish
          </p>
        </div>
        <div
          data-career-hero="accuracy"
          className="flex flex-col items-center border-l border-white/[0.08] px-3 text-center"
        >
          <p className="font-mono text-4xl leading-none tabular-nums tracking-wide text-sky-300 sm:text-5xl">
            {data.accuracy != null ? `${data.accuracy}%` : '—'}
          </p>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Accuracy
          </p>
        </div>
      </div>

      <div className={cn('h-px w-full', CAREER_HAIRLINE)} aria-hidden />

      {/* Stat strip — evenly spaced, no boxes */}
      <div className="flex items-start justify-between gap-2 px-1 py-5">
        {stripItems.map((item) => (
          <div
            key={item.label}
            className="min-w-0 flex-1 text-center"
          >
            <p className="font-mono text-sm tabular-nums text-foreground sm:text-[15px]">
              {item.value}
            </p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatMemberSince(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })
}

function sortEarnedNewestFirst(
  badges: AchievementWithStatus[],
): AchievementWithStatus[] {
  return [...badges]
    .filter((badge) => badge.earned)
    .sort(
      (a, b) =>
        Date.parse(b.earned_at ?? '') - Date.parse(a.earned_at ?? ''),
    )
}

function ProfilePoolCard({ pool }: { pool: ProfilePoolSummary }) {
  const TypeIcon = pool.scoringStyle === 'winner' ? Trophy : Target
  const typeLabel = formatScoringStyleLabel(pool.scoringStyle)
  const href = pool.inviteCode ? `/pool/${pool.inviteCode}` : null
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold',
            pool.scoringStyle === 'winner'
              ? 'border-amber-500/35 bg-amber-500/10 text-amber-400'
              : 'border-primary/35 bg-primary/10 text-primary',
          )}
        >
          <TypeIcon className="h-3 w-3 shrink-0" aria-hidden />
          {typeLabel}
        </span>
        {pool.standingRank != null ? (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {ordinalPlace(pool.standingRank)}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          'mt-2 line-clamp-2 font-display text-base tracking-wide text-foreground sm:text-lg',
          href && 'transition-colors group-hover:text-primary',
        )}
      >
        {pool.name}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Trophy className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{pool.eventName}</span>
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {pool.memberCount} {pool.memberCount === 1 ? 'member' : 'members'}
      </p>
    </>
  )

  const surfaceClass =
    'hue-card-surface group block rounded-2xl border border-primary/15 bg-gradient-to-br from-[#080b0f] via-[#0c1410] to-primary/[0.06] px-3.5 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'

  if (href) {
    return (
      <Link href={href} className={surfaceClass}>
        {inner}
      </Link>
    )
  }

  return <div className={surfaceClass}>{inner}</div>
}

function YourPoolsSection({
  pools,
  loading,
  isPublic,
  className,
}: {
  pools: ProfilePoolSummary[]
  loading: boolean
  isPublic: boolean
  className?: string
}) {
  const [showAll, setShowAll] = useState(false)
  const PREVIEW_COUNT = 4
  const hasMore = pools.length > PREVIEW_COUNT
  const visiblePools =
    showAll || !hasMore ? pools : pools.slice(0, PREVIEW_COUNT)

  return (
    <section className={className}>
      <h2 className="mb-2.5 font-display text-xl tracking-wide text-foreground">
        {isPublic ? 'Pools' : 'Your Pools'}
      </h2>
      {loading && pools.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Loading pools…
        </p>
      ) : pools.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {isPublic
            ? 'Not in any pools yet.'
            : 'Join or create a pool to see it here.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-3 xl:grid-cols-4">
            {visiblePools.map((pool) => (
              <ProfilePoolCard key={pool.id} pool={pool} />
            ))}
          </div>
          {hasMore ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-8 w-full text-[11px] text-muted-foreground"
              onClick={() => setShowAll((open) => !open)}
            >
              {showAll
                ? 'Show fewer'
                : `View all ${pools.length} pools`}
              <ChevronRight
                className={cn(
                  'ml-0.5 h-3 w-3 transition-transform',
                  showAll && 'rotate-90',
                )}
                aria-hidden
              />
            </Button>
          ) : null}
        </>
      )}
    </section>
  )
}

function SportsYouFollowSection({
  sports,
  loading,
  hasPools,
  isPublic,
  className,
}: {
  sports: ProfileSportSummary[]
  loading: boolean
  hasPools: boolean
  isPublic: boolean
  className?: string
}) {
  return (
    <section className={className}>
      <div className="mb-2.5">
        <h2 className="font-display text-xl tracking-wide text-foreground">
          {isPublic ? 'Sports played' : 'Sports You Play'}
        </h2>
        <p className="text-[10px] text-muted-foreground">
          From the events in {isPublic ? 'their' : 'your'} pools
        </p>
      </div>
      {loading && !hasPools ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Loading sports…
        </p>
      ) : sports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {isPublic
            ? 'No sports to show yet.'
            : 'Sports appear when you join pools.'}
        </p>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sports.map((item) => {
            const icon = sportIconPng(item.sport)
            const label = sportDisplayLabel(item.sport)
            return (
              <div
                key={item.key}
                className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1"
              >
                {icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/sports/${icon}`}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-card/70">
                    <Target className="h-6 w-6 text-foreground" aria-hidden />
                  </div>
                )}
                <span className="w-full truncate text-center text-[10px] font-medium leading-none text-foreground">
                  {label}
                </span>
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {item.poolCount} {item.poolCount === 1 ? 'pool' : 'pools'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function ProfileShowcase({
  userId,
  username = null,
  displayName,
  avatar,
  customAvatarUrl,
  predictionsMade: _predictionsMade,
  accuracy,
  totalPoints = null,
  exactScores = null,
  friendsCount = null,
  favoriteSports = [],
  createdAt = null,
  profileTitle = null,
  seasonLabel = null,
  active = true,
  mode = 'self',
  onEditProfile,
  isOwnPublicProfile = false,
  initialAchievements = null,
  initialActivity,
  loadError = null,
}: ProfileShowcaseProps) {
  const isPublic = mode === 'public'
  const [data, setData] = useState<UserAchievementsData | null>(
    initialAchievements,
  )
  const [progressRows, setProgressRows] = useState<UserAchievementProgress[]>(
    [],
  )
  const [loading, setLoading] = useState(false)
  const [sectionError, setSectionError] = useState<string | null>(loadError)
  const [profilePools, setProfilePools] = useState<ProfilePoolSummary[]>([])
  const [profileSports, setProfileSports] = useState<ProfileSportSummary[]>([])
  const [poolsLoading, setPoolsLoading] = useState(false)
  const [activity, setActivity] = useState<ProfileActivityItem[]>(
    initialActivity ?? [],
  )
  const [activityLoading, setActivityLoading] = useState(false)
  const [liveFriendsCount, setLiveFriendsCount] = useState<number | null>(
    friendsCount,
  )
  const [liveFavorites, setLiveFavorites] = useState<FavoriteSportChip[]>(
    favoriteSports,
  )
  const [liveUsername, setLiveUsername] = useState<string | null>(username)
  const [mutualFriendsCount, setMutualFriendsCount] = useState<number | null>(
    null,
  )
  const [viewerBlocked, setViewerBlocked] = useState(false)
  const badgeUnlock = useBadgeUnlockOptional()
  const viewedRef = useRef(false)

  const titleText = profileTitle?.trim() || ''
  const seasonText = seasonLabel?.trim() || ''
  const memberSince = formatMemberSince(createdAt)
  const handle = liveUsername?.trim() || null

  const reloadExtras = useCallback(async () => {
    if (!userId) return
    setSectionError(null)
    setActivityLoading(true)
    setPoolsLoading(true)

    const [poolsResult, recent, publicProfile] = await Promise.all([
      fetchProfilePools(supabase, userId, {
        includeInviteCodes: !isPublic,
      }),
      fetchProfileRecentActivity(supabase, userId, { limit: 5 }),
      fetchPublicProfile(supabase, userId),
    ])

    setProfilePools(poolsResult.pools)
    setProfileSports(poolsResult.sports)
    setPoolsLoading(false)

    if (recent.error) {
      setSectionError(recent.error)
    } else {
      setActivity(recent.items)
    }
    setActivityLoading(false)

    if (publicProfile) {
      if (publicProfile.friends_count != null) {
        setLiveFriendsCount(publicProfile.friends_count)
      }
      if (publicProfile.username) {
        setLiveUsername(publicProfile.username)
      }
      const favs = favoriteSportChips(publicProfile.favorite_sports)
      if (favs.length || publicProfile.favorite_sports != null) {
        setLiveFavorites(favs)
      }
    }
  }, [userId, isPublic])


  useEffect(() => {
    if (!active || !userId || viewedRef.current) return
    viewedRef.current = true
    capturePostHog('profile_viewed', {
      is_self: isOwnPublicProfile || !isPublic,
    })
  }, [active, userId, isPublic, isOwnPublicProfile])

  useEffect(() => {
    if (!active || !isPublic || isOwnPublicProfile || !userId) {
      setMutualFriendsCount(null)
      setViewerBlocked(false)
      return
    }
    let cancelled = false
    void Promise.all([
      getMutualFriendsCount(supabase, userId),
      isUserBlocked(supabase, userId),
    ]).then(([mutual, blocked]) => {
      if (cancelled) return
      setMutualFriendsCount(mutual.count)
      setViewerBlocked(blocked)
    })
    return () => {
      cancelled = true
    }
  }, [active, isPublic, isOwnPublicProfile, userId])

  useEffect(() => {
    if (!active || !userId) return
    // Public page preloads extras; self dashboard fetches client-side.
    if (isPublic && initialActivity) {
      setActivity(initialActivity)
      setLiveFriendsCount(friendsCount)
      setLiveFavorites(favoriteSports)
      setLiveUsername(username)
      void fetchProfilePools(supabase, userId, {
        includeInviteCodes: false,
      }).then((result) => {
        setProfilePools(result.pools)
        setProfileSports(result.sports)
        setPoolsLoading(false)
      })
      return
    }

    void reloadExtras()
  }, [
    active,
    userId,
    isPublic,
    initialActivity,
    friendsCount,
    favoriteSports,
    username,
    reloadExtras,
  ])

  useEffect(() => {
    if (!active || !userId) return
    if (isPublic && initialAchievements) {
      setData(initialAchievements)
      // Still load progress for public career metrics when not pre-supplied.
      if (
        exactScores == null ||
        totalPoints == null
      ) {
        void fetchUserAchievementProgress(supabase, userId).then((progress) => {
          setProgressRows(progress)
        })
      }
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      if (isPublic) {
        const [result, progress] = await Promise.all([
          fetchUserAchievementsReadOnly(supabase, userId),
          fetchUserAchievementProgress(supabase, userId),
        ])
        if (cancelled) return
        setData(result)
        setProgressRows(progress)
        setLoading(false)
        return
      }

      const [result, progress] = await Promise.all([
        fetchUserAchievements(supabase, userId),
        fetchUserAchievementProgress(supabase, userId),
      ])
      if (cancelled) return
      setData(result)
      badgeUnlock?.enqueueFromAchievementsData(result)
      setProgressRows(progress)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [
    active,
    userId,
    badgeUnlock,
    isPublic,
    initialAchievements,
    exactScores,
    totalPoints,
  ])

  const earnedBadges = useMemo(
    () => sortEarnedNewestFirst(data?.achievements ?? []),
    [data?.achievements],
  )
  const featuredBadges = earnedBadges.slice(0, 4)

  const totalXp = data?.totalXp ?? 0
  const level = data?.level ?? xpToLevel(totalXp)

  const metricValues = useMemo(() => {
    const values = new Map<string, number>()
    for (const row of progressRows) {
      const current = values.get(row.condition_metric) ?? 0
      if (row.current_value > current) {
        values.set(row.condition_metric, row.current_value)
      }
    }
    return values
  }, [progressRows])

  const resolvedExactScores =
    exactScores ?? metricValues.get('exact_scores') ?? 0
  const resolvedTotalPoints =
    totalPoints ?? metricValues.get('points_total') ?? null
  const nextAchievement = useMemo(
    () => (isPublic ? null : pickNextAchievement(progressRows)),
    [isPublic, progressRows],
  )

  const careerHighlights = useMemo((): CareerHighlightsData => {
    const poolsWon = metricValues.get('first_place_finishes') ?? 0
    const bestFinishRaw = metricValues.get('best_finish_rank_at_or_below')
    const podiums = metricValues.get('top3_finishes') ?? 0

    return {
      poolsWon,
      bestFinish:
        bestFinishRaw != null && bestFinishRaw > 0 ? bestFinishRaw : null,
      accuracy,
      totalPoints: resolvedTotalPoints,
      exactScores: resolvedExactScores,
      podiums,
    }
  }, [
    accuracy,
    metricValues,
    resolvedExactScores,
    resolvedTotalPoints,
  ])

  const showViewAllAchievements = !isPublic || isOwnPublicProfile

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-y-5 pb-8 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-6">
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
      {/* ── Hero: avatar|name left, XP below (lg: name + XP stack beside avatar) ── */}
      <section className="hue-card-surface relative max-lg:order-1 overflow-hidden rounded-[22px] border border-primary/15 bg-gradient-to-br from-[#080b0f] via-[#0c1410] to-primary/[0.06] shadow-[0_14px_36px_rgba(0,0,0,0.32)]">
        <div className="relative h-[104px] w-full sm:h-[120px] lg:h-[148px]">
          <Image
            src="/background_01.png"
            alt=""
            fill
            priority
            className="object-cover object-[center_35%]"
            sizes="(max-width: 1023px) 100vw, 66vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,15,0.15)_0%,rgba(8,11,15,0.55)_45%,rgba(8,11,15,0.98)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_55%)]" />

          {seasonText ||
          (!isPublic && onEditProfile) ||
          (isPublic && isOwnPublicProfile) ? (
            <div className="absolute right-2.5 top-2.5 z-20 flex max-w-[min(100%-1rem,16rem)] flex-col items-end gap-1.5 sm:right-3.5 sm:top-3.5 sm:max-w-[20rem] lg:right-6 lg:top-5 lg:max-w-none lg:flex-row lg:items-center lg:gap-2.5">
              {seasonText ? (
                <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-sm lg:px-2.5 lg:text-[10px]">
                  {seasonText}
                </span>
              ) : null}
              {!isPublic && onEditProfile ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={onEditProfile}
                  className={cn('hidden lg:inline-flex', FOCUS_VISIBLE_RING)}
                >
                  Edit Profile
                </Button>
              ) : null}
              {isPublic && isOwnPublicProfile ? (
                <Button
                  asChild
                  variant="default"
                  size="sm"
                  className={cn('hidden lg:inline-flex', FOCUS_VISIBLE_RING)}
                >
                  <Link href={DASHBOARD_TAB_HREFS.profile}>Edit Profile</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="relative px-4 pb-5 pt-1 sm:px-5 sm:pb-6 lg:px-8 lg:pb-8">
          {/* Identity: mobile avatar|name then XP; lg avatar left, name + XP right */}
          <div className="relative z-10 -mt-11 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-5 sm:-mt-12 sm:gap-x-4 sm:gap-y-6 lg:-mt-14 lg:gap-x-6 lg:gap-y-4">
            <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32 lg:row-span-2 lg:h-36 lg:w-36">
              <div className="h-full w-full overflow-hidden rounded-full border border-border bg-[#0b1711] shadow-[0_10px_22px_rgba(0,0,0,0.45)] ring-2 ring-background">
                <UserAvatarImage
                  avatar={avatar}
                  customAvatarUrl={customAvatarUrl}
                  className="h-full w-full rounded-full"
                  imgClassName={
                    customAvatarUrl
                      ? 'object-cover'
                      : 'object-contain object-bottom p-1'
                  }
                />
              </div>
              {!isPublic && onEditProfile ? (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 bg-[#0b1711] text-primary shadow-lg transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 lg:hidden"
                  aria-label="Edit profile and avatar"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pt-0.5 lg:pt-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="truncate font-display text-[22px] leading-none tracking-wide text-foreground sm:text-[26px] lg:text-[34px] lg:leading-[1.05]">
                    {displayName}
                  </h1>
                  {handle ? (
                    <p className="mt-1 truncate text-sm leading-snug text-muted-foreground lg:text-base">
                      @{handle}
                    </p>
                  ) : null}
                </div>
                {isPublic && isOwnPublicProfile ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className={cn(
                      'h-7 shrink-0 gap-1 px-2 text-[10px] lg:hidden',
                      FOCUS_VISIBLE_RING,
                    )}
                  >
                    <Link href={DASHBOARD_TAB_HREFS.profile}>
                      <Pencil className="h-3 w-3" aria-hidden />
                      Edit
                    </Link>
                  </Button>
                ) : null}
              </div>

              {titleText ? (
                <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[9px] font-semibold leading-none text-primary">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  {titleText}
                </span>
              ) : null}

              {memberSince ? (
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                  Member since {memberSince}
                </p>
              ) : null}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] leading-snug text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-foreground/90">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {liveFriendsCount != null
                    ? `${liveFriendsCount} friend${liveFriendsCount === 1 ? '' : 's'}`
                    : 'Friends'}
                </span>
                {isPublic &&
                !isOwnPublicProfile &&
                mutualFriendsCount != null &&
                mutualFriendsCount > 0 ? (
                  <span>
                    {mutualFriendsCount} mutual friend
                    {mutualFriendsCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            </div>

          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-base tracking-wide text-foreground sm:text-lg lg:text-xl">
                Level {level?.level ?? 1}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">
                {level?.nextLevelThreshold == null
                  ? `${totalXp.toLocaleString()} XP`
                  : `${totalXp.toLocaleString()}/${level.nextLevelThreshold.toLocaleString()} XP`}
                {level?.nextLevelThreshold != null
                  ? ` · ${(level?.xpToNext ?? 0).toLocaleString()} to next`
                  : ' · Max'}
              </span>
            </div>
            <div
              className="mt-2.5 h-2.5 overflow-hidden rounded-full border border-border bg-muted"
              role="progressbar"
              aria-label={`XP progress for Level ${level?.level ?? 1}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={level?.progressPct ?? 0}
            >
              <div
                className="h-full rounded-full bg-primary shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_40%,transparent)] transition-[width] duration-500"
                style={{ width: `${level?.progressPct ?? 0}%` }}
              />
            </div>
          </div>
          </div>

          {isPublic && !isOwnPublicProfile ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {viewerBlocked ? (
                <span className="text-xs text-muted-foreground">
                  You’ve blocked this user
                </span>
              ) : (
                <FriendshipButton
                  profileUserId={userId}
                  onAction={(action) => {
                    if (action === 'accepted' || action === 'request_sent') {
                      capturePostHog('user_followed')
                    }
                  }}
                />
              )}
              <UserModerationMenu
                targetUserId={userId}
                onBlockedChange={(blocked) => setViewerBlocked(blocked)}
                onBlocked={() => {
                  setLiveFriendsCount((prev) =>
                    prev != null && prev > 0 ? prev - 1 : prev,
                  )
                }}
              />
              <ReportUserButton profileUserId={userId} />
            </div>
          ) : null}
        </div>
      </section>

      {sectionError ? (
        <div className="max-lg:order-2 rounded-2xl border border-border bg-card/70 px-4 py-6 text-center">
          <p className="text-sm text-destructive">{sectionError}</p>
          <Button
            type="button"
            variant="outline"
            className={cn('mt-3', FOCUS_VISIBLE_RING)}
            onClick={() => void reloadExtras()}
          >
            Try again
          </Button>
        </div>
      ) : null}

        <section className="max-lg:order-9">
          <div className="mb-2.5">
            <h2 className="font-display text-xl tracking-wide text-foreground">
              Career Highlights
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Your PoolCup career at a glance
            </p>
          </div>
          <CareerHighlightsResume data={careerHighlights} />
        </section>

        <section className="max-lg:order-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl tracking-wide text-foreground">
                Featured Badges
              </h2>
              <p className="text-[10px] text-muted-foreground">
                Recent unlocks · rarity from catalogue
              </p>
            </div>
            {showViewAllAchievements ? (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-7 gap-0.5 px-1.5 text-[10px] text-muted-foreground"
              >
                <Link href="/achievements">
                  View all
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>

          {loading && featuredBadges.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading badges…
            </p>
          ) : featuredBadges.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {isPublic
                ? 'No badges unlocked yet.'
                : 'Earn badges to feature them here.'}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-x-1 gap-y-2 lg:gap-x-3 lg:gap-y-3">
              {featuredBadges.map((badge) => {
                const rarity = achievementRarityLabel(badge.rarity)
                const rarityStyle = ACHIEVEMENT_RARITY_STYLES[rarity]
                return (
                  <div
                    key={badge.id}
                    className="flex w-full min-w-0 flex-col items-center px-0.5 text-center"
                  >
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden sm:h-[4.5rem] sm:w-[4.5rem] lg:h-[5.5rem] lg:w-[5.5rem]">
                      <AchievementBadgeArt
                        achievementId={badge.id}
                        artFilename={badge.art_filename}
                        src={badge.imageUrl}
                      />
                    </div>
                    <p className="mt-1.5 w-full line-clamp-2 text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
                      {badge.name}
                    </p>
                    <span
                      className={cn(
                        'mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em]',
                        rarityStyle.text,
                      )}
                    >
                      {rarity}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <YourPoolsSection
          className="max-lg:order-5"
          pools={profilePools}
          loading={poolsLoading}
          isPublic={isPublic}
        />

        {liveFavorites.length > 0 ? (
          <section className="max-lg:order-6">
            <h2 className="font-display text-xl tracking-wide text-foreground">
              Favorite sports
            </h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {liveFavorites.map((sport) => (
                <span
                  key={sport.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {sport.ballSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sport.ballSrc}
                      alt=""
                      className="h-4 w-4 object-contain"
                    />
                  ) : null}
                  {sport.label}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <SportsYouFollowSection
          className="max-lg:order-7"
          sports={profileSports}
          loading={poolsLoading}
          hasPools={profilePools.length > 0}
          isPublic={isPublic}
        />
      </div>

      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
        <section className="max-lg:order-8 rounded-2xl border border-border/90 bg-card/90 p-4">
          <h2 className="font-display text-xl tracking-wide text-foreground">
            Prediction Accuracy
          </h2>
          <p className="mt-2 font-mono text-4xl tabular-nums text-foreground">
            {accuracy == null ? '—' : `${accuracy}%`}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Correct winner picks across classic match predictions
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Exact
              </p>
              <p className="mt-0.5 font-mono text-lg tabular-nums text-foreground">
                {resolvedExactScores.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Points
              </p>
              <p className="mt-0.5 font-mono text-lg tabular-nums text-foreground">
                {(resolvedTotalPoints ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        {!isPublic ? (
          <section className="hue-card-surface max-lg:order-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card/95 via-[#0c1410] to-primary/[0.06] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Next Unlock
              </p>
              {nextAchievement ? (
                <span className="font-mono text-[11px] tabular-nums text-primary">
                  {nextAchievement.progress_pct}%
                </span>
              ) : null}
            </div>
            {nextAchievement ? (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background/50 p-1">
                  <AchievementBadgeArt
                    achievementId={nextAchievement.achievement_id}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg tracking-wide text-foreground">
                    {nextAchievement.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {nextAchievement.description}
                  </p>
                  <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {nextAchievement.current_value.toLocaleString()}/
                    {nextAchievement.threshold.toLocaleString()}
                  </p>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`Progress on ${nextAchievement.name}`}
                    aria-valuenow={nextAchievement.progress_pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${nextAchievement.progress_pct}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Next achievement progress will show as you play.
              </p>
            )}
          </section>
        ) : null}

        {showViewAllAchievements ? (
          <ProfileAnalyticsEntry className="max-lg:order-10" />
        ) : null}

        <section className="max-lg:order-11">
          <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-xl tracking-wide text-foreground">
              Recent activity
            </h2>
            {!isPublic || isOwnPublicProfile ? (
              <Link
                href="/history"
                className={cn(
                  'text-xs font-medium text-primary underline-offset-4 hover:underline',
                  FOCUS_VISIBLE_RING,
                )}
              >
                View all history
              </Link>
            ) : null}
          </div>
          {activityLoading && activity.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
              No recent scored activity yet.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {activity.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border/80 bg-card/70 px-3 py-2.5"
                  >
                    {item.kind === 'badge' ? (
                      <p className="text-sm text-foreground">
                        Unlocked{' '}
                        <span className="font-semibold">{item.title}</span>
                      </p>
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.team1Name} {item.predTeam1}–{item.predTeam2}{' '}
                          {item.team2Name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.resultTeam1 != null && item.resultTeam2 != null
                            ? `Final ${item.resultTeam1}–${item.resultTeam2} · `
                            : null}
                          {item.points} pts
                          {item.eventName ? ` · ${item.eventName}` : null}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {!isPublic || isOwnPublicProfile ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={cn('mt-3 w-full', FOCUS_VISIBLE_RING)}
                >
                  <Link href="/history">View all history</Link>
                </Button>
              ) : null}
            </>
          )}
        </section>
      </div>

    </div>
  )
}
