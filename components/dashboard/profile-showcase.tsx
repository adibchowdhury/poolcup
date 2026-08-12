'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { useBadgeUnlockOptional } from '@/components/achievements/badge-unlock-provider'
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Crown,
  Flame,
  Lock,
  Medal,
  Pencil,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { FriendshipButton } from '@/components/friends/friendship-button'
import { UserModerationMenu } from '@/components/friends/user-moderation-menu'
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
  fetchProfileBreakdownStats,
  fetchProfileRecentActivity,
  type ProfileActivityItem,
  type ProfileCompetitionStat,
  type ProfileSportStat,
} from '@/src/lib/fetch-profile-activity'
import {
  fetchUserGlobalRank,
  type UserGlobalRank,
} from '@/src/lib/global-rank'
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
import {
  applyStreakSyncFeedback,
  syncPredictionStreak,
} from '@/src/lib/streak-client'
import { useXpFeedbackOptional } from '@/components/xp/xp-feedback-provider'
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
  /** Public profiles: longest prediction-day streak only. */
  longestStreak?: number | null
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
  initialSportStats?: ProfileSportStat[]
  initialCompetitionStats?: ProfileCompetitionStat[]
  initialActivity?: ProfileActivityItem[]
  initialGlobalRank?: UserGlobalRank | null
  loadError?: string | null
  /** Peak level from users.highest_level. */
  highestLevel?: number | null
}

type ProfileTab = 'overview' | 'progress' | 'achievements' | 'stats'

type CareerItem = {
  label: string
  value: string
  icon: typeof Trophy
  accent: string
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

function formatEarnedDate(value: string | null): string {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
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

function metricUnit(metric: string, value: number): string {
  if (metric === 'predictions_made')
    return value === 1 ? 'prediction' : 'predictions'
  if (metric === 'correct_predictions')
    return value === 1 ? 'correct pick' : 'correct picks'
  if (metric === 'exact_scores')
    return value === 1 ? 'exact score' : 'exact scores'
  if (metric === 'pools_joined') return value === 1 ? 'pool' : 'pools'
  if (metric === 'pools_created')
    return value === 1 ? 'pool created' : 'pools created'
  if (metric === 'first_place_finishes') return value === 1 ? 'win' : 'wins'
  if (metric === 'top3_finishes') return value === 1 ? 'podium' : 'podiums'
  if (metric === 'consecutive_correct')
    return value === 1 ? 'correct in a row' : 'correct in a row'
  return ''
}

/** Top X% from global rank (rank ÷ total), never fabricated. */
function topPercentFromRank(
  rank: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (rank == null || total == null || total <= 0 || rank <= 0) return null
  return Math.max(1, Math.min(100, Math.ceil((rank / total) * 100)))
}

function CareerHighlightsGrid({ items }: { items: CareerItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Career milestones will appear as you compete.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((highlight) => (
        <article
          key={highlight.label}
          className={cn(
            'rounded-2xl border p-3 shadow-[0_8px_20px_rgba(0,0,0,0.18)]',
            highlight.accent,
          )}
        >
          <highlight.icon className="h-4 w-4 opacity-90" aria-hidden />
          <p className="mt-2 font-display text-2xl leading-none tabular-nums text-foreground">
            {highlight.value}
          </p>
          <p className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {highlight.label}
          </p>
        </article>
      ))}
    </div>
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
          'mt-2 font-display text-xl tracking-wide text-foreground',
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
}: {
  pools: ProfilePoolSummary[]
  loading: boolean
  isPublic: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  const PREVIEW_COUNT = 4
  const hasMore = pools.length > PREVIEW_COUNT
  const visiblePools =
    showAll || !hasMore ? pools : pools.slice(0, PREVIEW_COUNT)

  return (
    <section>
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
}: {
  sports: ProfileSportSummary[]
  loading: boolean
  hasPools: boolean
  isPublic: boolean
}) {
  return (
    <section>
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

function BadgeDetailList({
  badges,
  progressById,
  showLockedProgress,
  emptyMessage,
}: {
  badges: AchievementWithStatus[]
  progressById: Map<string, UserAchievementProgress>
  showLockedProgress: boolean
  emptyMessage: string
}) {
  if (badges.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {badges.map((badge) => {
        const rarity = achievementRarityLabel(badge.rarity)
        const rarityStyle = ACHIEVEMENT_RARITY_STYLES[rarity]
        const progress = progressById.get(badge.id)
        const currentValue = Math.min(
          progress?.current_value ?? 0,
          progress?.threshold ?? badge.threshold,
        )
        const threshold = progress?.threshold ?? badge.threshold
        const progressPct = progress?.progress_pct ?? 0
        const remaining = Math.max(0, threshold - currentValue)
        const unit = metricUnit(badge.condition_metric, remaining)

        return (
          <article
            key={badge.id}
            className={cn(
              'rounded-[14px] border border-border/90 bg-card/90 px-2.5 py-2.5',
              rarityStyle.border,
              rarityStyle.glow,
              badge.earned && 'bg-primary/[0.04]',
            )}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border bg-black/25 p-0.5',
                  rarityStyle.border,
                  !badge.earned && 'opacity-55 grayscale',
                )}
              >
                <AchievementBadgeArt
                  achievementId={badge.id}
                  artFilename={badge.art_filename}
                  src={badge.imageUrl}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {badge.name}
                  </p>
                  <span
                    className={cn(
                      'shrink-0 text-[8px] font-bold uppercase tracking-[0.08em]',
                      rarityStyle.text,
                    )}
                  >
                    {rarity}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[9px] text-muted-foreground/80">
                  {badge.description}
                </p>
              </div>
              {badge.earned ? (
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-primary"
                  aria-label="Unlocked"
                />
              ) : (
                <Lock
                  className="h-4 w-4 shrink-0 text-muted-foreground/50"
                  aria-label="Locked"
                />
              )}
            </div>

            {badge.earned ? (
              <div className="mt-2 flex items-center justify-between border-t border-border pt-1.5 text-[9px]">
                <span className="text-muted-foreground">
                  Unlocked {formatEarnedDate(badge.earned_at)}
                </span>
                <span className="font-semibold tabular-nums text-primary">
                  +{badge.xp_value} XP
                </span>
              </div>
            ) : showLockedProgress && progress ? (
              <div className="mt-2 border-t border-white/6 pt-1.5">
                <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
                  <span className="truncate">
                    {currentValue.toLocaleString()}/
                    {threshold.toLocaleString()}
                    {metricUnit(badge.condition_metric, threshold)
                      ? ` ${metricUnit(badge.condition_metric, threshold)}`
                      : ''}
                  </span>
                  <span className="shrink-0">
                    {remaining > 0
                      ? `${remaining.toLocaleString()}${unit ? ` ${unit}` : ''} more`
                      : 'Ready to unlock'}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/55">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-700',
                      rarityStyle.bar,
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

export function ProfileShowcase({
  userId,
  username = null,
  displayName,
  avatar,
  customAvatarUrl,
  predictionsMade,
  accuracy,
  totalPoints = null,
  exactScores = null,
  longestStreak = null,
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
  initialSportStats,
  initialCompetitionStats,
  initialActivity,
  initialGlobalRank = null,
  loadError = null,
  highestLevel: highestLevelProp = null,
}: ProfileShowcaseProps) {
  const isPublic = mode === 'public'
  const [data, setData] = useState<UserAchievementsData | null>(
    initialAchievements,
  )
  const [progressRows, setProgressRows] = useState<UserAchievementProgress[]>(
    [],
  )
  const [peakLevel, setPeakLevel] = useState<number | null>(highestLevelProp)
  const [loading, setLoading] = useState(false)
  const [sectionError, setSectionError] = useState<string | null>(loadError)
  const [globalRank, setGlobalRank] = useState<UserGlobalRank | null>(
    initialGlobalRank,
  )
  const [globalRankLoaded, setGlobalRankLoaded] = useState(
    initialGlobalRank != null,
  )
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview')
  const [profilePools, setProfilePools] = useState<ProfilePoolSummary[]>([])
  const [profileSports, setProfileSports] = useState<ProfileSportSummary[]>([])
  const [poolsLoading, setPoolsLoading] = useState(false)
  const [sportStats, setSportStats] = useState<ProfileSportStat[]>(
    initialSportStats ?? [],
  )
  const [competitionStats, setCompetitionStats] = useState<
    ProfileCompetitionStat[]
  >(initialCompetitionStats ?? [])
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
  const xp = useXpFeedbackOptional()
  const viewedRef = useRef(false)
  const streakViewedRef = useRef(false)
  const [dayCurrentStreak, setDayCurrentStreak] = useState<number | null>(null)
  const [dayLongestStreak, setDayLongestStreak] = useState<number | null>(
    longestStreak,
  )
  const [streakLoading, setStreakLoading] = useState(!isPublic)
  const [streakError, setStreakError] = useState<string | null>(null)

  const titleText = profileTitle?.trim() || ''
  const seasonText = seasonLabel?.trim() || ''
  const memberSince = formatMemberSince(createdAt)
  const handle = liveUsername?.trim() || null

  const reloadExtras = useCallback(async () => {
    if (!userId) return
    setSectionError(null)
    setActivityLoading(true)
    setPoolsLoading(true)

    const [poolsResult, breakdown, recent, publicProfile] = await Promise.all([
      fetchProfilePools(supabase, userId, {
        includeInviteCodes: !isPublic,
      }),
      fetchProfileBreakdownStats(supabase, userId),
      fetchProfileRecentActivity(supabase, userId, { limit: 12 }),
      fetchPublicProfile(supabase, userId),
    ])

    setProfilePools(poolsResult.pools)
    setProfileSports(poolsResult.sports)
    setPoolsLoading(false)

    if (breakdown.error || recent.error) {
      setSectionError(breakdown.error || recent.error)
    } else {
      setSportStats(breakdown.sports)
      setCompetitionStats(breakdown.competitions)
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
      profile_user_id: userId,
      viewer: isOwnPublicProfile || !isPublic ? 'self' : 'other',
      mode: isPublic ? 'public' : 'self',
    })
  }, [active, userId, isPublic, isOwnPublicProfile])

  useEffect(() => {
    setDayLongestStreak(longestStreak)
  }, [longestStreak])

  useEffect(() => {
    if (!active || !userId || isPublic) {
      setStreakLoading(false)
      return
    }

    let cancelled = false
    setStreakLoading(true)
    setStreakError(null)

    void (async () => {
      const result = await syncPredictionStreak()
      if (cancelled) return
      if (!result || result.error) {
        setStreakError(result?.error ?? 'Could not load streak')
        setStreakLoading(false)
        return
      }
      setDayCurrentStreak(result.current_streak)
      setDayLongestStreak(result.longest_streak)
      applyStreakSyncFeedback(result, { onLevelUp: xp?.enqueueLevelUp })
      if (!streakViewedRef.current) {
        streakViewedRef.current = true
        capturePostHog('streak_viewed', {
          current_streak: result.current_streak,
          longest_streak: result.longest_streak,
          surface: 'profile',
        })
      }
      setStreakLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [active, userId, isPublic, xp?.enqueueLevelUp])

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
    if (initialGlobalRank) {
      setGlobalRank(initialGlobalRank)
      setGlobalRankLoaded(true)
      return
    }

    let cancelled = false
    setGlobalRankLoaded(false)

    void (async () => {
      const rank = await fetchUserGlobalRank(supabase, userId)
      if (cancelled) return
      setGlobalRank(rank)
      setGlobalRankLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [active, userId, initialGlobalRank])

  useEffect(() => {
    if (!active || !userId) return
    // Public page preloads extras; self dashboard fetches client-side.
    if (isPublic && initialActivity) {
      setActivity(initialActivity)
      setSportStats(initialSportStats ?? [])
      setCompetitionStats(initialCompetitionStats ?? [])
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
    initialSportStats,
    initialCompetitionStats,
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
        longestStreak == null ||
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
      const peakPromise = supabase
        .from('users')
        .select('highest_level')
        .eq('id', userId)
        .maybeSingle()

      if (isPublic) {
        const [result, progress, peak] = await Promise.all([
          fetchUserAchievementsReadOnly(supabase, userId),
          fetchUserAchievementProgress(supabase, userId),
          peakPromise,
        ])
        if (cancelled) return
        setData(result)
        setProgressRows(progress)
        setPeakLevel(
          Math.max(
            1,
            Number(peak.data?.highest_level) || result.level.level,
          ),
        )
        setLoading(false)
        return
      }

      const [result, progress, peak] = await Promise.all([
        fetchUserAchievements(supabase, userId),
        fetchUserAchievementProgress(supabase, userId),
        peakPromise,
      ])
      if (cancelled) return
      setData(result)
      badgeUnlock?.enqueueFromAchievementsData(result)
      setProgressRows(progress)
      setPeakLevel(
        Math.max(1, Number(peak.data?.highest_level) || result.level.level),
      )
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
    longestStreak,
    totalPoints,
  ])

  const progressById = useMemo(
    () =>
      new Map(progressRows.map((row) => [row.achievement_id, row] as const)),
    [progressRows],
  )
  const earnedBadges = useMemo(
    () => sortEarnedNewestFirst(data?.achievements ?? []),
    [data?.achievements],
  )
  const featuredBadges = earnedBadges.slice(0, 4)

  const lockedNearComplete = useMemo(() => {
    if (isPublic) return []
    return (data?.achievements ?? [])
      .filter(
        (badge) =>
          !badge.earned && badge.is_active && badge.buildable === 'green',
      )
      .sort(
        (a, b) =>
          (progressById.get(b.id)?.progress_pct ?? 0) -
          (progressById.get(a.id)?.progress_pct ?? 0),
      )
      .slice(0, 5)
  }, [data?.achievements, progressById, isPublic])

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

  const correctRun =
    metricValues.get('consecutive_correct') ?? 0
  const predictionCurrent =
    !isPublic ? (dayCurrentStreak ?? 0) : null
  const predictionLongest =
    dayLongestStreak ?? longestStreak ?? 0
  const resolvedExactScores =
    exactScores ?? metricValues.get('exact_scores') ?? 0
  const resolvedTotalPoints =
    totalPoints ?? metricValues.get('points_total') ?? null
  const nextAchievement = useMemo(
    () => (isPublic ? null : pickNextAchievement(progressRows)),
    [isPublic, progressRows],
  )

  const topPct = topPercentFromRank(
    globalRank?.global_rank,
    globalRank?.total_ranked,
  )

  const careerHighlights = useMemo(() => {
    const items: CareerItem[] = []

    items.push({
      label: 'Predictions',
      value: predictionsMade.toLocaleString(),
      icon: Target,
      accent: 'text-foreground border-border bg-card/80',
    })

    if (accuracy != null) {
      items.push({
        label: 'Accuracy',
        value: `${accuracy}%`,
        icon: Target,
        accent: 'text-sky-300 border-sky-400/20 bg-sky-400/[0.06]',
      })
    }

    if (resolvedExactScores > 0) {
      items.push({
        label: 'Exact Scores',
        value: resolvedExactScores.toLocaleString(),
        icon: Award,
        accent: 'text-foreground border-border bg-card/80',
      })
    }

    if (resolvedTotalPoints != null) {
      items.push({
        label: 'Total Points',
        value: resolvedTotalPoints.toLocaleString(),
        icon: Zap,
        accent: 'text-foreground border-border bg-card/80',
      })
    }

    if (!isPublic && predictionCurrent != null && predictionCurrent > 0) {
      items.push({
        label: 'Current Streak',
        value: `${predictionCurrent}`,
        icon: Flame,
        accent: 'text-orange-300 border-orange-400/20 bg-orange-400/[0.06]',
      })
    }

    if (predictionLongest > 0) {
      items.push({
        label: 'Longest Streak',
        value: `${predictionLongest}`,
        icon: Flame,
        accent: 'text-orange-300 border-orange-400/20 bg-orange-400/[0.06]',
      })
    }

    if (correctRun > 0) {
      items.push({
        label: 'Best correct run',
        value: `${correctRun}`,
        icon: Sparkles,
        accent: 'text-amber-300 border-amber-400/20 bg-amber-400/[0.06]',
      })
    }

    const poolsWon = metricValues.get('first_place_finishes')
    if (poolsWon != null && poolsWon > 0) {
      items.push({
        label: 'Pools Won',
        value: poolsWon.toLocaleString(),
        icon: Crown,
        accent: 'text-primary border-primary/20 bg-primary/[0.06]',
      })
    }

    const bestFinish = metricValues.get('best_finish_rank_at_or_below')
    if (bestFinish != null && bestFinish > 0) {
      items.push({
        label: 'Best Finish',
        value: `#${bestFinish}`,
        icon: Trophy,
        accent: 'text-primary border-primary/20 bg-primary/[0.06]',
      })
    }

    const podiums = metricValues.get('top3_finishes')
    if (podiums != null && podiums > 0) {
      items.push({
        label: 'Podium',
        value: podiums.toLocaleString(),
        icon: Medal,
        accent: 'text-sky-300 border-sky-400/20 bg-sky-400/[0.06]',
      })
    }

    return items
  }, [
    accuracy,
    correctRun,
    isPublic,
    metricValues,
    predictionCurrent,
    predictionLongest,
    predictionsMade,
    resolvedExactScores,
    resolvedTotalPoints,
  ])

  const showViewAllAchievements = !isPublic || isOwnPublicProfile

  const rankOf =
    globalRankLoaded &&
    globalRank?.global_rank != null &&
    globalRank.total_ranked > 0
      ? `of ${globalRank.total_ranked.toLocaleString()}`
      : null

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 pb-8">
      {/* ── Hero: avatar|name left, rank top-right, XP below ── */}
      <section className="hue-card-surface relative overflow-hidden rounded-[22px] border border-primary/15 bg-gradient-to-br from-[#080b0f] via-[#0c1410] to-primary/[0.06] shadow-[0_14px_36px_rgba(0,0,0,0.32)]">
        <div className="relative h-[104px] w-full sm:h-[120px]">
          <Image
            src="/background_01.png"
            alt=""
            fill
            priority
            className="object-cover object-[center_35%]"
            sizes="(max-width: 512px) 100vw, 512px"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,15,0.15)_0%,rgba(8,11,15,0.55)_45%,rgba(8,11,15,0.98)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,230,118,0.12),transparent_55%)]" />

          {/* Global rank — top-right corner of hero */}
          <div className="absolute right-2.5 top-2.5 z-20 flex max-w-[min(100%-1rem,15rem)] flex-col items-end gap-1.5 sm:right-3.5 sm:top-3.5 sm:max-w-[18rem]">
            {globalRankLoaded ? (
              globalRank?.global_rank != null ? (
                <div
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:gap-1.5 sm:px-2.5"
                  aria-label={`Global rank ${globalRank.global_rank}${
                    globalRank.total_ranked > 0
                      ? ` of ${globalRank.total_ranked}`
                      : ''
                  }${topPct != null ? `, top ${topPct}%` : ''}`}
                >
                  <Crown
                    className="h-2.5 w-2.5 shrink-0 text-primary sm:h-3 sm:w-3"
                    aria-hidden
                  />
                  <span className="truncate font-display text-[10px] tracking-wide text-foreground sm:text-xs">
                    <span className="sm:hidden">
                      #{globalRank.global_rank.toLocaleString()}
                    </span>
                    <span className="hidden sm:inline">
                      Global Rank #{globalRank.global_rank.toLocaleString()}
                    </span>
                  </span>
                  {topPct != null ? (
                    <span className="shrink-0 text-[8px] font-semibold tabular-nums text-primary sm:text-[9px]">
                      Top {topPct}%
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-2 py-1 text-muted-foreground backdrop-blur-sm sm:px-2.5">
                  <Medal className="h-2.5 w-2.5 opacity-70" aria-hidden />
                  <span className="font-display text-[10px] tracking-wide sm:text-xs">
                    Unranked
                  </span>
                </div>
              )
            ) : null}
            {seasonText ? (
              <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-sm">
                {seasonText}
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative px-4 pb-5 pt-1 sm:px-5 sm:pb-6">
          {/* Identity row: avatar + name / member since (rank is top-right) */}
          <div className="relative z-10 -mt-11 flex items-end gap-4 sm:-mt-12 sm:gap-5">
            <div className="relative h-[88px] w-[88px] shrink-0 sm:h-[96px] sm:w-[96px]">
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
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 bg-[#0b1711] text-primary shadow-lg transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label="Edit profile and avatar"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pb-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="truncate font-display text-[22px] leading-none tracking-wide text-foreground sm:text-[26px]">
                    {displayName}
                  </h1>
                  {handle ? (
                    <p className="mt-1.5 truncate text-sm text-muted-foreground">
                      @{handle}
                    </p>
                  ) : null}
                </div>
                {isPublic && isOwnPublicProfile ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className={cn('h-7 shrink-0 gap-1 px-2 text-[10px]', FOCUS_VISIBLE_RING)}
                  >
                    <Link href={DASHBOARD_TAB_HREFS.profile}>
                      <Pencil className="h-3 w-3" aria-hidden />
                      Edit
                    </Link>
                  </Button>
                ) : null}
              </div>

              {titleText ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[9px] font-semibold text-primary">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  {titleText}
                </span>
              ) : null}

              {memberSince ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Member since {memberSince}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
                <span>
                  {predictionsMade.toLocaleString()} prediction
                  {predictionsMade === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>

          {/* Level + XP */}
          <div className="mt-5 sm:mt-6">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-base tracking-wide text-foreground sm:text-lg">
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
                className="h-full rounded-full bg-primary shadow-[0_0_8px_rgba(0,230,118,0.4)] transition-[width] duration-500"
                style={{ width: `${level?.progressPct ?? 0}%` }}
              />
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
                    capturePostHog('friend_action', {
                      action,
                      profile_user_id: userId,
                    })
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

      {/* ── Tabs: Overview · Progress · Achievements · Stats ── */}
      <Tabs
        value={profileTab}
        onValueChange={(value) => {
          const next = value as ProfileTab
          setProfileTab(next)
          capturePostHog('tab_changed', {
            surface: 'profile',
            tab: next,
            profile_user_id: userId,
          })
        }}
        className="gap-3"
      >
        <TabsList className="grid h-auto w-full grid-cols-4 gap-0.5 rounded-xl border border-border/90 bg-card/90 p-1">
          {(
            [
              ['overview', 'Overview'],
              ['progress', 'Progress'],
              ['achievements', 'Achievements'],
              ['stats', 'Stats'],
            ] as const
          ).map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                'min-w-0 rounded-lg px-1 py-2 text-[10px] leading-tight sm:px-2 sm:text-[11px] data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none',
                FOCUS_VISIBLE_RING,
              )}
            >
              <span className="truncate">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {sectionError ? (
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-6 text-center">
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

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-1 space-y-5">
          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3">
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
              <div className="grid grid-cols-4 gap-x-2 gap-y-3">
                {featuredBadges.map((badge) => {
                  const rarity = achievementRarityLabel(badge.rarity)
                  const rarityStyle = ACHIEVEMENT_RARITY_STYLES[rarity]
                  return (
                    <div
                      key={badge.id}
                      className="flex min-w-0 flex-col items-center text-center"
                    >
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden sm:h-14 sm:w-14">
                        <AchievementBadgeArt
                          achievementId={badge.id}
                          artFilename={badge.art_filename}
                          src={badge.imageUrl}
                        />
                      </div>
                      <p className="mt-2 line-clamp-2 text-[9px] font-semibold leading-tight text-foreground sm:text-[10px]">
                        {badge.name}
                      </p>
                      <span
                        className={cn(
                          'mt-1 text-[7px] font-bold uppercase tracking-[0.08em]',
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
            pools={profilePools}
            loading={poolsLoading}
            isPublic={isPublic}
          />

          {liveFavorites.length > 0 ? (
            <section>
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
            sports={profileSports}
            loading={poolsLoading}
            hasPools={profilePools.length > 0}
            isPublic={isPublic}
          />

          <section>
            <h2 className="mb-2.5 font-display text-xl tracking-wide text-foreground">
              Recent activity
            </h2>
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
              <ul className="space-y-2">
                {activity.map((item) => (
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
            )}
          </section>
        </TabsContent>

        {/* PROGRESS — XP, levels, global rank, next unlock */}
        <TabsContent value="progress" className="mt-1 space-y-5">
          <section className="rounded-2xl border border-border/90 bg-card/90 p-4">
            <h2 className="font-display text-xl tracking-wide text-foreground">
              Level & XP
            </h2>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Level
                </p>
                <p className="mt-0.5 font-display text-4xl leading-none tabular-nums text-foreground">
                  {level?.level ?? 1}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {totalXp.toLocaleString()}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    XP
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {level?.nextLevelThreshold == null
                    ? 'Max level'
                    : `${(level?.xpToNext ?? 0).toLocaleString()} to next`}
                </p>
              </div>
            </div>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full border border-border bg-muted"
              role="progressbar"
              aria-label={`XP progress for Level ${level?.level ?? 1}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={level?.progressPct ?? 0}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${level?.progressPct ?? 0}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[11px] tabular-nums text-muted-foreground">
              {level?.nextLevelThreshold == null
                ? `${totalXp.toLocaleString()} XP · Max level`
                : `${totalXp.toLocaleString()} / ${level.nextLevelThreshold.toLocaleString()} XP`}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Highest level reached{' '}
              <span className="font-mono tabular-nums text-foreground">
                {Math.max(peakLevel ?? 1, level?.level ?? 1)}
              </span>
            </p>
          </section>

          <section className="rounded-2xl border border-border/90 bg-card/90 p-4">
            <h2 className="font-display text-xl tracking-wide text-foreground">
              Global Rank
            </h2>
            {globalRankLoaded ? (
              globalRank?.global_rank != null ? (
                <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                  <p className="font-display text-4xl leading-none tabular-nums text-foreground">
                    #{globalRank.global_rank.toLocaleString()}
                  </p>
                  <div className="pb-1">
                    {rankOf ? (
                      <p className="text-sm text-muted-foreground">{rankOf}</p>
                    ) : null}
                    {topPct != null ? (
                      <p className="text-sm font-semibold text-primary">
                        Top {topPct}%
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Unranked</p>
              )
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Loading rank…</p>
            )}
          </section>

          {!isPublic ? (
            <section className="hue-card-surface overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card/95 via-[#0c1410] to-primary/[0.06] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
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
        </TabsContent>

        {/* ACHIEVEMENTS */}
        <TabsContent value="achievements" className="mt-1 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl tracking-wide text-foreground">
                Achievements
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {earnedBadges.length} unlocked
                {data?.totalCount
                  ? ` · ${data.totalCount} in catalogue`
                  : ''}
              </p>
            </div>
            {showViewAllAchievements ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-[11px]"
              >
                <Link href="/achievements">
                  Full page
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>

          {loading && !data ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Loading achievements…
            </p>
          ) : (
            <>
              <BadgeDetailList
                badges={earnedBadges}
                progressById={progressById}
                showLockedProgress={false}
                emptyMessage={
                  isPublic
                    ? 'No badges unlocked yet.'
                    : 'Your achievement collection will appear here.'
                }
              />
              {!isPublic && lockedNearComplete.length > 0 ? (
                <div className="pt-2">
                  <h3 className="mb-2 font-display text-base tracking-wide text-muted-foreground">
                    In progress
                  </h3>
                  <BadgeDetailList
                    badges={lockedNearComplete}
                    progressById={progressById}
                    showLockedProgress
                    emptyMessage=""
                  />
                </div>
              ) : null}
            </>
          )}
        </TabsContent>

        {/* STATS — accuracy, career, per-sport / per-competition */}
        <TabsContent value="stats" className="mt-1 space-y-5">
          <section className="rounded-2xl border border-border/90 bg-card/90 p-4">
            <h2 className="font-display text-xl tracking-wide text-foreground">
              Prediction Accuracy
            </h2>
            <p className="mt-2 font-display text-4xl tabular-nums text-foreground">
              {accuracy == null ? '—' : `${accuracy}%`}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Correct winner picks across classic match predictions
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Predictions
                </p>
                <p className="mt-0.5 font-mono text-lg tabular-nums text-foreground">
                  {predictionsMade.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Exact
                </p>
                <p className="mt-0.5 font-mono text-lg tabular-nums text-foreground">
                  {resolvedExactScores.toLocaleString()}
                </p>
              </div>
              {!isPublic ? (
                <div className="rounded-xl border border-orange-400/20 bg-orange-400/[0.06] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Current streak
                  </p>
                  {streakLoading ? (
                    <ShimmerBlock className="mt-1 h-6 w-10 rounded-md" />
                  ) : (
                    <p className="mt-0.5 font-mono text-lg tabular-nums text-foreground">
                      {predictionCurrent ?? 0}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Points
                  </p>
                  <p className="mt-0.5 font-mono text-lg tabular-nums text-foreground">
                    {(resolvedTotalPoints ?? 0).toLocaleString()}
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-orange-400/20 bg-orange-400/[0.06] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Longest streak
                </p>
                {streakLoading && !isPublic ? (
                  <ShimmerBlock className="mt-1 h-6 w-10 rounded-md" />
                ) : (
                  <p className="mt-0.5 font-mono text-lg tabular-nums text-foreground">
                    {predictionLongest}
                  </p>
                )}
              </div>
            </div>
            {streakError && !isPublic ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-[11px] text-destructive">{streakError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn('h-7 px-2 text-[11px]', FOCUS_VISIBLE_RING)}
                  onClick={() => {
                    streakViewedRef.current = false
                    setDayCurrentStreak(null)
                    setStreakLoading(true)
                    setStreakError(null)
                    void syncPredictionStreak().then((result) => {
                      if (!result || result.error) {
                        setStreakError(result?.error ?? 'Could not load streak')
                        setStreakLoading(false)
                        return
                      }
                      setDayCurrentStreak(result.current_streak)
                      setDayLongestStreak(result.longest_streak)
                      applyStreakSyncFeedback(result, {
                        onLevelUp: xp?.enqueueLevelUp,
                      })
                      setStreakLoading(false)
                    })
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : !isPublic &&
              !streakLoading &&
              (predictionCurrent ?? 0) === 0 &&
              predictionLongest === 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Start your streak — predict today!
              </p>
            ) : null}
          </section>

          <section>
            <div className="mb-2.5">
              <h2 className="font-display text-xl tracking-wide text-foreground">
                Career Highlights
              </h2>
              <p className="text-[10px] text-muted-foreground">
                From pool finishes and prediction stats
              </p>
            </div>
            <CareerHighlightsGrid items={careerHighlights} />
          </section>

          <section>
            <h2 className="font-display text-xl tracking-wide text-foreground">
              By sport
            </h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Post-lock predictions only · expands as more sports launch
            </p>
            {activityLoading && sportStats.length === 0 ? (
              <div className="mt-3 space-y-2">
                <ShimmerBlock className="h-16 w-full rounded-xl" />
              </div>
            ) : sportStats.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
                No scored predictions by sport yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sportStats.map((row) => (
                  <li
                    key={row.sportKey}
                    className="rounded-xl border border-border/80 bg-card/70 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {row.sportLabel}
                      </p>
                      <p className="font-mono text-sm tabular-nums text-foreground">
                        {row.points} pts
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.predictions} preds
                      {row.accuracy != null ? ` · ${row.accuracy}%` : ''}
                      {` · ${row.exactScores} exact`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-display text-xl tracking-wide text-foreground">
              By competition
            </h2>
            {activityLoading && competitionStats.length === 0 ? (
              <div className="mt-3 space-y-2">
                <ShimmerBlock className="h-16 w-full rounded-xl" />
              </div>
            ) : competitionStats.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
                No scored predictions by competition yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {competitionStats.map((row) => (
                  <li
                    key={row.eventId}
                    className="rounded-xl border border-border/80 bg-card/70 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {row.eventName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {row.sportLabel}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                        {row.points} pts
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.predictions} preds
                      {row.accuracy != null ? ` · ${row.accuracy}%` : ''}
                      {` · ${row.exactScores} exact`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
