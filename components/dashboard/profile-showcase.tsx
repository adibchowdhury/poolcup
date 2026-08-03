'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { useBadgeUnlockOptional } from '@/components/achievements/badge-unlock-provider'
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crown,
  Flame,
  Lock,
  Medal,
  Pencil,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { FriendshipButton } from '@/components/friends/friendship-button'
import { ProfileFriendsEntry } from '@/components/friends/profile-friends-entry'
import { cn } from '@/lib/utils'
import {
  fetchUserAchievementProgress,
  fetchUserAchievements,
  type AchievementWithStatus,
  type UserAchievementProgress,
  type UserAchievementsData,
} from '@/src/lib/fetch-user-achievements'
import { fetchUserAchievementsReadOnly } from '@/src/lib/fetch-public-profile'
import { DASHBOARD_TAB_HREFS } from '@/src/lib/mobile-bottom-nav-routes'
import { supabase } from '@/src/lib/supabase'
import { xpToLevel } from '@/src/lib/levels'

export type ProfileShowcaseMode = 'self' | 'public'

type ProfileShowcaseProps = {
  userId: string
  displayName: string
  avatar: string
  customAvatarUrl: string | null
  predictionsMade: number
  accuracy: number | null
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

type AchievementRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary'

const RARITY_STYLES: Record<
  AchievementRarity,
  { border: string; text: string; bar: string; glow: string }
> = {
  Common: {
    border: 'border-slate-400/25',
    text: 'text-slate-300',
    bar: 'bg-slate-400',
    glow: 'shadow-[0_0_18px_rgba(148,163,184,0.08)]',
  },
  Rare: {
    border: 'border-sky-400/35',
    text: 'text-sky-300',
    bar: 'bg-sky-400',
    glow: 'shadow-[0_0_20px_rgba(56,189,248,0.12)]',
  },
  Epic: {
    border: 'border-purple-400/35',
    text: 'text-purple-300',
    bar: 'bg-purple-400',
    glow: 'shadow-[0_0_20px_rgba(192,132,252,0.13)]',
  },
  Legendary: {
    border: 'border-amber-400/40',
    text: 'text-amber-300',
    bar: 'bg-amber-400',
    glow: 'shadow-[0_0_24px_rgba(251,191,36,0.16)]',
  },
}

function getRarity(xpValue: number): AchievementRarity {
  if (xpValue <= 50) return 'Common'
  if (xpValue <= 250) return 'Rare'
  if (xpValue <= 600) return 'Epic'
  return 'Legendary'
}

function buildPreview(
  achievements: AchievementWithStatus[],
  progressById: Map<string, UserAchievementProgress>,
  /** Public profiles only surface earned badges (no locked progress). */
  earnedOnly: boolean,
): AchievementWithStatus[] {
  const earned = sortEarnedNewestFirst(achievements)
  if (earnedOnly) return earned.slice(0, 5)

  const locked = achievements
    .filter((badge) => !badge.earned && badge.buildable === 'green')
    .sort(
      (a, b) =>
        (progressById.get(b.id)?.progress_pct ?? 0) -
        (progressById.get(a.id)?.progress_pct ?? 0),
    )
  const preview = [...earned.slice(0, 2), ...locked.slice(0, 3)]

  if (preview.length < 5) {
    const used = new Set(preview.map((badge) => badge.id))
    preview.push(
      ...achievements
        .filter((badge) => !used.has(badge.id))
        .slice(0, 5 - preview.length),
    )
  }

  return preview.slice(0, 5)
}

function metricUnit(metric: string, value: number): string {
  if (metric === 'predictions_made') return value === 1 ? 'prediction' : 'predictions'
  if (metric === 'correct_predictions') return value === 1 ? 'correct pick' : 'correct picks'
  if (metric === 'exact_scores') return value === 1 ? 'exact score' : 'exact scores'
  if (metric === 'pools_joined') return value === 1 ? 'pool' : 'pools'
  if (metric === 'pools_created') return value === 1 ? 'pool created' : 'pools created'
  if (metric === 'first_place_finishes') return value === 1 ? 'win' : 'wins'
  if (metric === 'top3_finishes') return value === 1 ? 'podium' : 'podiums'
  if (metric === 'consecutive_correct') return value === 1 ? 'correct in a row' : 'correct in a row'
  return ''
}

export function ProfileShowcase({
  userId,
  displayName,
  avatar,
  customAvatarUrl,
  predictionsMade,
  accuracy,
  active = true,
  mode = 'self',
  onEditProfile,
  isOwnPublicProfile = false,
  initialAchievements = null,
}: ProfileShowcaseProps) {
  const isPublic = mode === 'public'
  const [data, setData] = useState<UserAchievementsData | null>(
    initialAchievements,
  )
  const [progressRows, setProgressRows] = useState<UserAchievementProgress[]>([])
  const [loading, setLoading] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const badgeUnlock = useBadgeUnlockOptional()

  useEffect(() => {
    if (!active || !userId) return
    // Public page may pass server-preloaded achievements — still allow refresh
    // only for self mode (evaluate path). Public never re-runs evaluate.
    if (isPublic && initialAchievements) {
      setData(initialAchievements)
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      if (isPublic) {
        // READ-ONLY — never call evaluate_user_achievements for other users.
        const result = await fetchUserAchievementsReadOnly(supabase, userId)
        if (cancelled) return
        setData(result)
        setProgressRows([])
        setLoading(false)
        return
      }

      const result = await fetchUserAchievements(supabase, userId)
      const progress = await fetchUserAchievementProgress(supabase, userId)
      if (cancelled) return
      setData(result)
      badgeUnlock?.enqueueFromAchievementsData(result)
      setProgressRows(progress)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [active, userId, badgeUnlock, isPublic, initialAchievements])

  const progressById = useMemo(
    () =>
      new Map(progressRows.map((row) => [row.achievement_id, row] as const)),
    [progressRows],
  )
  const preview = useMemo(
    () => buildPreview(data?.achievements ?? [], progressById, isPublic),
    [data?.achievements, progressById, isPublic],
  )
  const earnedTimeline = useMemo(
    () => sortEarnedNewestFirst(data?.achievements ?? []),
    [data?.achievements],
  )

  const totalXp = data?.totalXp ?? 0
  const level = data?.level ?? xpToLevel(totalXp)
  const stats = [
    {
      label: 'Total XP',
      value: totalXp.toLocaleString(),
      icon: Zap,
      accent:
        'border-amber-400/25 bg-[linear-gradient(145deg,rgba(251,191,36,0.16),rgba(15,18,15,0.88))] text-amber-300',
    },
    {
      label: 'Accuracy',
      value: accuracy == null ? '—' : `${accuracy}%`,
      icon: TrendingUp,
      accent:
        'border-sky-400/25 bg-[linear-gradient(145deg,rgba(56,189,248,0.15),rgba(11,18,22,0.9))] text-sky-300',
    },
    {
      label: 'Badges',
      value: (data?.earnedCount ?? 0).toLocaleString(),
      icon: Award,
      accent:
        'border-purple-400/25 bg-[linear-gradient(145deg,rgba(192,132,252,0.15),rgba(17,13,22,0.9))] text-purple-300',
    },
    {
      label: 'Predictions Made',
      value: predictionsMade.toLocaleString(),
      icon: Target,
      accent:
        'border-primary/25 bg-[linear-gradient(145deg,rgba(0,230,118,0.15),rgba(9,20,14,0.9))] text-primary',
    },
  ] as const

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

  const careerHighlights = [
    {
      label: 'Highest Pool Finish',
      value: metricValues.get('best_finish_rank_at_or_below')
        ? `#${metricValues.get('best_finish_rank_at_or_below')}`
        : null,
      icon: Trophy,
      accent: 'text-amber-300 border-amber-400/25 bg-amber-400/[0.07]',
    },
    {
      label: 'Longest Correct Streak',
      value: metricValues.get('consecutive_correct')
        ? `${metricValues.get('consecutive_correct')} straight`
        : null,
      icon: Flame,
      accent: 'text-orange-300 border-orange-400/25 bg-orange-400/[0.07]',
    },
    {
      label: 'Pools Won',
      value: metricValues.get('first_place_finishes')
        ? metricValues.get('first_place_finishes')!.toLocaleString()
        : null,
      icon: Crown,
      accent: 'text-purple-300 border-purple-400/25 bg-purple-400/[0.07]',
    },
    {
      label: 'Podium Finishes',
      value: metricValues.get('top3_finishes')
        ? metricValues.get('top3_finishes')!.toLocaleString()
        : null,
      icon: Medal,
      accent: 'text-sky-300 border-sky-400/25 bg-sky-400/[0.07]',
    },
  ].filter((item) => item.value != null)

  return (
    <div className="mx-auto w-full max-w-md space-y-5 pb-6 pt-10">
      <section className="relative rounded-[22px] border border-primary/18 bg-[radial-gradient(circle_at_50%_0%,rgba(0,230,118,0.16),transparent_48%),linear-gradient(155deg,rgba(20,38,29,0.97),rgba(8,17,13,0.99))] px-3 pb-3 pt-[78px] shadow-[0_18px_45px_rgba(0,0,0,0.34),0_1px_0_rgba(255,255,255,0.055)_inset]">
        <div className="absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 -translate-y-[38%]">
          <svg
            className="-rotate-90"
            viewBox="0 0 128 128"
            aria-hidden
          >
            <circle
              cx="64"
              cy="64"
              r="58"
              fill="rgba(8,17,13,0.98)"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="5"
            />
            <circle
              cx="64"
              cy="64"
              r="58"
              fill="none"
              stroke="rgb(0,230,118)"
              strokeWidth="5"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - (level?.progressPct ?? 0)}
              className="drop-shadow-[0_0_7px_rgba(0,230,118,0.65)] transition-[stroke-dashoffset] duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-[13px] rounded-[19px] border border-primary/30 bg-[#0b1711] p-1 shadow-[0_10px_25px_rgba(0,0,0,0.35)]">
            <UserAvatarImage
              avatar={avatar}
              customAvatarUrl={customAvatarUrl}
              className="h-full w-full rounded-[15px] border border-white/10"
              imgClassName={
                customAvatarUrl
                  ? 'object-cover'
                  : 'object-contain object-bottom p-0.5'
              }
            />
            {!isPublic && onEditProfile ? (
              <button
                type="button"
                onClick={onEditProfile}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-primary/50 bg-[#102219] text-primary shadow-lg transition-colors hover:bg-primary hover:text-primary-foreground"
                aria-label="Edit profile and avatar"
              >
                <Pencil className="h-2.5 w-2.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full border border-primary/35 bg-[#102219] px-2 py-0.5 font-display text-xs text-primary shadow-[0_0_12px_rgba(0,230,118,0.28)]">
            {level?.level ?? 1}
          </span>
        </div>

        <div className="text-center">
          <h1 className="truncate font-display text-[25px] tracking-wide text-foreground">
            {displayName}
          </h1>
          <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground/75">
            PoolCup player profile
          </p>
          {isPublic && isOwnPublicProfile ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                <Link href={DASHBOARD_TAB_HREFS.profile}>
                  <Pencil className="h-3 w-3" aria-hidden />
                  Edit profile
                </Link>
              </Button>
              <ProfileFriendsEntry active={active} />
            </div>
          ) : null}
          {isPublic && !isOwnPublicProfile ? (
            <div className="mt-3 flex justify-center">
              <FriendshipButton profileUserId={userId} />
            </div>
          ) : null}
          {!isPublic ? (
            <div className="mt-3 flex justify-center">
              <ProfileFriendsEntry active={active} />
            </div>
          ) : null}

          <div className="mx-auto mt-4 max-w-[330px] text-left">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-lg tracking-wide text-foreground">
                Level {level?.level ?? 1}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {level?.nextLevelThreshold == null
                  ? `${totalXp.toLocaleString()} XP · Max level`
                  : `${totalXp.toLocaleString()} / ${level.nextLevelThreshold.toLocaleString()} XP`}
              </span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full border border-white/5 bg-black/55"
              role="progressbar"
              aria-label={`XP progress for Level ${level?.level ?? 1}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={level?.progressPct ?? 0}
            >
              <div
                className="h-full rounded-full bg-primary shadow-[0_0_8px_rgba(0,230,118,0.5)] transition-[width] duration-500"
                style={{ width: `${level?.progressPct ?? 0}%` }}
              />
            </div>
            <p className="mt-1.5 text-center text-[10px] font-medium text-primary/85">
              {level?.nextLevelThreshold == null
                ? 'Highest level reached'
                : `${level?.xpToNext.toLocaleString() ?? '100'} XP to Level ${(level?.level ?? 1) + 1}`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-1.5">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className={cn(
                'min-w-0 rounded-xl border px-1 py-2.5 text-center shadow-[0_8px_20px_rgba(0,0,0,0.16)]',
                stat.accent,
              )}
            >
              <stat.icon className="mx-auto h-3.5 w-3.5" aria-hidden />
              <p className="mt-1 truncate font-display text-base leading-none tabular-nums text-foreground sm:text-lg">
                {stat.value}
              </p>
              <p className="mt-1 truncate text-[7px] font-medium uppercase tracking-[0.04em] text-muted-foreground sm:text-[8px]">
                {stat.label}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl tracking-wide text-foreground">
            {isPublic ? 'Achievements' : 'Your Achievements'}
          </h2>
          {!isPublic ? (
            <Button asChild variant="ghost" size="sm" className="h-7 gap-0.5 px-1.5 text-[10px] text-muted-foreground">
              <Link href="/achievements">
                View all
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </Button>
          ) : isOwnPublicProfile ? (
            <Button asChild variant="ghost" size="sm" className="h-7 gap-0.5 px-1.5 text-[10px] text-muted-foreground">
              <Link href="/achievements">
                View all
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>

        {loading && !data ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading achievements…
          </p>
        ) : preview.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {isPublic
              ? 'No badges unlocked yet.'
              : 'Your achievement collection will appear here.'}
          </p>
        ) : (
          <div className="mt-2.5 space-y-2">
            {preview.map((badge) => {
              const rarity = getRarity(badge.xp_value)
              const rarityStyle = RARITY_STYLES[rarity]
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
                    'rounded-[14px] border bg-[#0c1712]/85 px-2.5 py-2.5',
                    rarityStyle.border,
                    rarityStyle.glow,
                    badge.earned &&
                      'bg-[linear-gradient(105deg,rgba(0,230,118,0.07),rgba(12,23,18,0.92))]',
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
                      <AchievementBadgeArt achievementId={badge.id} />
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
                        className="h-4 w-4 shrink-0 text-primary drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]"
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
                    <div className="mt-2 flex items-center justify-between border-t border-white/6 pt-1.5 text-[9px]">
                      <span className={rarityStyle.text}>Unlocked</span>
                      <span className="font-semibold tabular-nums text-primary">
                        +{badge.xp_value} XP
                      </span>
                    </div>
                  ) : progress ? (
                    <div className="mt-2 border-t border-white/6 pt-1.5">
                      <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
                        <span className="truncate">
                          {currentValue.toLocaleString()}/{threshold.toLocaleString()}
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
        )}
      </section>

      {careerHighlights.length > 0 && !isPublic ? (
        <section>
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl tracking-wide text-foreground">
                Career Highlights
              </h2>
              <p className="text-[9px] text-muted-foreground">
                Real milestones from your PoolCup career
              </p>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {careerHighlights.map((highlight) => (
              <article
                key={highlight.label}
                className={cn(
                  'rounded-[13px] border p-3',
                  highlight.accent,
                )}
              >
                <highlight.icon className="h-4 w-4" aria-hidden />
                <p className="mt-2 font-display text-xl leading-none text-foreground">
                  {highlight.value}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
                  {highlight.label}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[13px] border border-white/8 bg-[#0c1712]/65">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
          onClick={() => setHistoryExpanded((expanded) => !expanded)}
          aria-expanded={historyExpanded}
        >
          <div>
            <h2 className="font-display text-base tracking-wide text-foreground">
              Achievements Earned
              <span className="ml-2 text-sm text-muted-foreground">
                ({earnedTimeline.length})
              </span>
            </h2>
            <p className="text-[9px] text-muted-foreground">
              XP history · most recent first
            </p>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              historyExpanded && 'rotate-180',
            )}
            aria-hidden
          />
        </button>

        {historyExpanded ? (
          earnedTimeline.length === 0 ? (
            <p className="border-t border-white/8 px-4 py-6 text-center text-xs text-muted-foreground">
              {isPublic
                ? 'No badges unlocked yet.'
                : 'Earn your first badge to start your XP history.'}
            </p>
          ) : (
          <ol className="max-h-72 space-y-0.5 overflow-y-auto border-t border-white/8 px-3 py-2">
            {earnedTimeline.map((badge) => (
              <li
                key={badge.id}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.025]"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.06]">
                  <Award className="h-3 w-3 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {badge.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatEarnedDate(badge.earned_at)}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-primary">
                  +{badge.xp_value} XP
                </span>
              </li>
            ))}
          </ol>
          )
        ) : null}
      </section>
    </div>
  )
}
