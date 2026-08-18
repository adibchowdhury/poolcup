'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/src/lib/supabase'
import { useBadgeUnlockOptional } from '@/components/achievements/badge-unlock-provider'
import {
  fetchUserAchievementProgress,
  fetchUserAchievements,
  type UserAchievementProgress,
  type UserAchievementsData,
} from '@/src/lib/fetch-user-achievements'
import { pickNextAchievement } from '@/src/lib/pick-next-achievement'
import { xpToLevel } from '@/src/lib/levels'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

type AchievementsFeedContentProps = {
  userId: string
  /** Report when this block has nothing useful to show (after load). */
  onEmptyChange?: (empty: boolean) => void
}

const SURFACE = 'rounded-xl border border-border/90 bg-card/90'

/** Achievements body for the dashboard feed (no section chrome — embed under Your Progress). */
export function AchievementsFeedContent({
  userId,
  onEmptyChange,
}: AchievementsFeedContentProps) {
  const [data, setData] = useState<UserAchievementsData | null>(null)
  const [progressRows, setProgressRows] = useState<UserAchievementProgress[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const badgeUnlock = useBadgeUnlockOptional()

  useEffect(() => {
    if (!userId) {
      setData(null)
      setProgressRows([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void Promise.all([
      fetchUserAchievements(supabase, userId),
      fetchUserAchievementProgress(supabase, userId),
    ]).then(([achievements, progress]) => {
      if (cancelled) return
      setData(achievements)
      setProgressRows(progress)
      badgeUnlock?.enqueueFromAchievementsData(achievements)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [userId, badgeUnlock])

  const level = data?.level ?? xpToLevel(0)
  const totalXp = data?.totalXp ?? 0
  const earnedCount = data?.earnedCount ?? 0

  const recentBadges = useMemo(() => {
    if (!data) return []
    const earned = data.achievements.filter((badge) => badge.earned)
    return [...earned]
      .sort((a, b) => {
        const aTime = a.earned_at ? Date.parse(a.earned_at) : 0
        const bTime = b.earned_at ? Date.parse(b.earned_at) : 0
        return bTime - aTime
      })
      .slice(0, 12)
  }, [data])

  const nextAchievement = useMemo(
    () => pickNextAchievement(progressRows),
    [progressRows],
  )

  const showLevelCard =
    totalXp > 0 ||
    earnedCount > 0 ||
    nextAchievement != null
  const showRecent = recentBadges.length > 0
  const showNext = nextAchievement != null
  const isEmpty = !showLevelCard && !showRecent && !showNext

  useEffect(() => {
    if (loading) return
    onEmptyChange?.(isEmpty)
  }, [loading, isEmpty, onEmptyChange])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2
          className="h-5 w-5 animate-spin text-primary"
          aria-label="Loading achievements"
        />
      </div>
    )
  }

  if (isEmpty) return null

  return (
    <div className="flex flex-col gap-2.5">
      {showLevelCard ? (
        <div className={cn(SURFACE, 'px-3.5 py-3 sm:px-4')}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Level
              </p>
              <p className="mt-0.5 font-display text-3xl leading-none tracking-tight tabular-nums text-foreground sm:text-4xl">
                {level.level}
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
                {level.nextLevelThreshold == null
                  ? 'Max level'
                  : `${level.xpToNext.toLocaleString()} to next`}
              </p>
            </div>
          </div>

          <div
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={
              level.nextLevelThreshold == null
                ? `Level ${level.level} complete`
                : `Progress to Level ${level.level + 1}`
            }
            aria-valuenow={level.progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${level.progressPct}%` }}
            />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              Badges{' '}
              <span className="font-mono tabular-nums text-foreground">
                {earnedCount}
              </span>
              {data?.totalCount != null ? (
                <span className="text-muted-foreground">
                  /{data.totalCount}
                </span>
              ) : null}
            </span>
            <Link
              href="/achievements"
              className={cn(
                'ml-auto inline-flex items-center gap-1 rounded-sm text-[11px] font-medium text-primary hover:underline',
                FOCUS_VISIBLE_RING,
              )}
            >
              Collection
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </div>
      ) : null}

      {showRecent ? (
        <div className={cn(SURFACE, 'px-3 py-2.5')}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Recently unlocked
            </p>
          </div>
          <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            {recentBadges.map((badge) => (
              <Link
                key={badge.id}
                href="/achievements"
                title={`${badge.name} (+${badge.xp_value} XP)`}
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/50 p-1.5 transition-colors hover:border-primary/40',
                  FOCUS_VISIBLE_RING,
                )}
              >
                <AchievementBadgeArt
                  achievementId={badge.id}
                  artFilename={badge.art_filename}
                  src={badge.imageUrl}
                  alt={badge.name}
                />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {showNext && nextAchievement ? (
        <div
          className={cn(
            SURFACE,
            'flex min-w-0 items-center gap-3 px-3 py-2 sm:px-3.5',
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Next
            </p>
            <p className="truncate text-sm font-medium text-foreground">
              {nextAchievement.name}
            </p>
            <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              {nextAchievement.current_value}/{nextAchievement.threshold}
            </p>
          </div>
          <div className="w-[5.5rem] shrink-0 sm:w-28">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={`Progress on ${nextAchievement.name}`}
              aria-valuenow={nextAchievement.progress_pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${nextAchievement.progress_pct}%` }}
              />
            </div>
            <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
              {nextAchievement.progress_pct}%
            </p>
          </div>
        </div>
      ) : null}

      {data?.error ? (
        <p className="text-[11px] text-muted-foreground">{data.error}</p>
      ) : null}
    </div>
  )
}
