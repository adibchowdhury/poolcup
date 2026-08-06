'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Lock, Loader2 } from 'lucide-react'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import {
  BadgeUnlockProvider,
  useBadgeUnlock,
} from '@/components/achievements/badge-unlock-provider'
import { cn } from '@/lib/utils'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'
import {
  formatAchievementEarnedDate,
  getAchievementUiState,
  groupAchievementsForDisplay,
} from '@/src/lib/achievement-catalogue-layout'
import {
  fetchUserAchievementProgress,
  fetchUserAchievements,
  type AchievementWithStatus,
  type UserAchievementProgress,
  type UserAchievementsData,
} from '@/src/lib/fetch-user-achievements'
import { xpToLevel } from '@/src/lib/levels'

function BadgeCard({
  badge,
  progress,
}: {
  badge: AchievementWithStatus
  progress: UserAchievementProgress | null
}) {
  const state = getAchievementUiState(badge)
  const progressPct =
    state === 'locked' && progress
      ? Math.min(100, Math.max(0, progress.progress_pct))
      : null

  const xpLabel =
    state === 'coming_soon'
      ? 'Soon'
      : state === 'earned'
        ? `+${badge.xp_value} XP`
        : `${badge.xp_value} XP`

  return (
    <article className="relative flex w-28 shrink-0 flex-col items-center pt-1 text-center sm:w-32">
      <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
        <div
          className={cn(
            'absolute inset-0',
            state !== 'earned' && 'opacity-40 grayscale',
          )}
        >
          <AchievementBadgeArt
            achievementId={badge.id}
            artFilename={badge.art_filename}
            src={badge.imageUrl}
            className="h-full w-full"
          />
        </div>

        <span
          className={cn(
            'absolute -right-2 -top-1 z-10 max-w-[5.5rem] truncate rounded-full px-2 py-0.5 text-[10px] font-bold leading-none tabular-nums shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:-right-2.5 sm:text-[11px]',
            state === 'earned'
              ? 'bg-primary text-primary-foreground'
              : state === 'coming_soon'
                ? 'border border-white/10 bg-background/90 text-muted-foreground/70'
                : 'border border-primary/30 bg-primary/15 text-primary/80',
          )}
        >
          {xpLabel}
        </span>

        {state === 'locked' ? (
          <span
            className="absolute -bottom-0.5 -left-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-background/85 text-muted-foreground sm:h-6 sm:w-6"
            aria-label="Locked"
          >
            <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden />
          </span>
        ) : null}

        {state === 'coming_soon' ? (
          <span
            className="absolute -bottom-0.5 -left-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-background/85 text-muted-foreground sm:h-6 sm:w-6"
            aria-label="Coming soon"
          >
            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex w-full min-w-0 max-w-full flex-col items-center overflow-hidden">
        <h3
          className={cn(
            'line-clamp-2 min-h-[1.75rem] w-full max-w-full break-words text-xs font-semibold leading-tight',
            state === 'earned' ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {badge.name}
        </h3>
        <p
          className={cn(
            'mt-0 line-clamp-3 min-h-[2.4rem] w-full max-w-full break-words text-[10px] leading-snug',
            state === 'earned'
              ? 'text-muted-foreground'
              : 'text-muted-foreground/70',
          )}
        >
          {badge.description}
        </p>

        {state === 'earned' ? (
          <p className="mt-0.5 text-[10px] font-medium text-primary">
            Unlocked {formatAchievementEarnedDate(badge.earned_at)}
          </p>
        ) : null}

        {state === 'coming_soon' ? (
          <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">
            Coming soon
          </p>
        ) : null}

        {state === 'locked' && progressPct != null ? (
          <div className="mt-1 w-full space-y-0.5 px-0.5">
            <div className="flex items-center justify-between gap-1 text-[9px] tabular-nums text-muted-foreground">
              <span>
                {progress!.current_value}/{progress!.threshold}
              </span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full bg-primary/80 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function AchievementsPageView() {
  return (
    <BadgeUnlockProvider>
      <AchievementsPageContent />
    </BadgeUnlockProvider>
  )
}

function AchievementsPageContent() {
  const { user, loading: authLoading } = useAuth()
  const { enqueueFromAchievementsData } = useBadgeUnlock()
  const [data, setData] = useState<UserAchievementsData | null>(null)
  const [progressRows, setProgressRows] = useState<UserAchievementProgress[]>(
    [],
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      setData(null)
      setProgressRows([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      const [result, progress] = await Promise.all([
        fetchUserAchievements(supabase, user.id),
        fetchUserAchievementProgress(supabase, user.id),
      ])
      if (cancelled) return
      setData(result)
      setProgressRows(progress)
      enqueueFromAchievementsData(result)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, user?.id, enqueueFromAchievementsData])

  const progressById = useMemo(
    () =>
      new Map(progressRows.map((row) => [row.achievement_id, row] as const)),
    [progressRows],
  )

  const groups = useMemo(
    () => groupAchievementsForDisplay(data?.achievements ?? []),
    [data?.achievements],
  )

  if (authLoading || loading) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center justify-center px-4 py-8">
        <Loader2
          className="h-8 w-8 animate-spin text-primary"
          aria-label="Loading achievements"
        />
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto min-h-[70vh] w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <h1 className="font-display text-3xl tracking-wide text-foreground sm:text-4xl">
            Achievements
          </h1>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Sign in to view your achievements.
        </p>
      </main>
    )
  }

  const earned = data?.earnedCount ?? 0
  const total = data?.totalCount ?? 0
  const totalXp = data?.totalXp ?? 0
  const level = data?.level ?? xpToLevel(0)
  const overallPct = total > 0 ? Math.round((earned / total) * 100) : 0

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <h1 className="font-display text-3xl tracking-wide text-foreground sm:text-4xl">
              Achievements
            </h1>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">
            Level {level.level}
            <span className="mx-2 text-border">•</span>
            {totalXp.toLocaleString()} XP
            {data?.error ? (
              <>
                <span className="mx-2 text-border">•</span>
                <span className="text-amber-400/90">{data.error}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm">
          <p className="font-display text-2xl tracking-wide tabular-nums text-foreground">
            {earned}
            <span className="text-muted-foreground"> / {total}</span>
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            Earned · {overallPct}%
          </p>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {data?.error ?? 'No achievements found.'}
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <section key={group.id} className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-3 border-b border-white/8 pb-0.5">
                <h2 className="font-display text-2xl tracking-wide text-foreground">
                  {group.label}
                </h2>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {group.earnedCount}/{group.totalCount}
                </p>
              </div>

              <div
                className={cn(
                  '-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:-mx-6 sm:px-6',
                  'scrollbar-none',
                )}
                role="list"
                aria-label={`${group.label} badges`}
              >
                <div className="flex w-max items-start gap-1 pr-8 sm:gap-1.5 sm:pr-12">
                  {group.badges.map((badge) => (
                    <div
                      key={badge.id}
                      role="listitem"
                      className="w-28 shrink-0 sm:w-32"
                    >
                      <BadgeCard
                        badge={badge}
                        progress={progressById.get(badge.id) ?? null}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
