'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Lock, Loader2 } from 'lucide-react'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { BadgeDetailModal } from '@/components/achievements/badge-detail-modal'
import {
  BadgeUnlockProvider,
  useBadgeUnlock,
} from '@/components/achievements/badge-unlock-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/src/lib/auth-context'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { supabase } from '@/src/lib/supabase'
import {
  formatAchievementEarnedDate,
  getAchievementUiState,
  groupAchievementsForDisplay,
} from '@/src/lib/achievement-catalogue-layout'
import {
  achievementRarityLabel,
  ACHIEVEMENT_RARITY_STYLES,
} from '@/src/lib/achievement-rarity'
import {
  fetchUserAchievementProgress,
  fetchUserAchievements,
  type AchievementWithStatus,
  type UserAchievementProgress,
  type UserAchievementsData,
} from '@/src/lib/fetch-user-achievements'
import { xpToLevel } from '@/src/lib/levels'
import { capturePostHog } from '@/src/lib/posthog-client'

function BadgeCard({
  badge,
  progress,
  onOpen,
}: {
  badge: AchievementWithStatus
  progress: UserAchievementProgress | null
  onOpen: (badge: AchievementWithStatus) => void
}) {
  const state = getAchievementUiState(badge)
  const rarity = achievementRarityLabel(badge.rarity)
  const rarityStyle = ACHIEVEMENT_RARITY_STYLES[rarity]
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
    <button
      type="button"
      onClick={() => onOpen(badge)}
      className={cn(
        'relative flex w-full flex-col items-center rounded-xl pt-1 text-center transition-colors hover:bg-muted/20',
        FOCUS_VISIBLE_RING,
      )}
      aria-label={`${badge.name}, ${rarity}, ${state === 'earned' ? 'unlocked' : state === 'coming_soon' ? 'coming soon' : 'locked'}`}
    >
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
            aria-hidden
          >
            <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          </span>
        ) : null}

        {state === 'coming_soon' ? (
          <span
            className="absolute -bottom-0.5 -left-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-background/85 text-muted-foreground sm:h-6 sm:w-6"
            aria-hidden
          >
            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex w-full min-w-0 max-w-full flex-col items-center overflow-hidden px-0.5">
        <span
          className={cn(
            'mt-0.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]',
            rarityStyle.chip,
          )}
        >
          {rarity}
        </span>
        <h3
          className={cn(
            'mt-1 line-clamp-2 min-h-[1.75rem] w-full max-w-full break-words text-xs font-semibold leading-tight',
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
                className={cn('h-full rounded-full', rarityStyle.bar)}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </button>
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadError(null)
    try {
      const [result, progress] = await Promise.all([
        fetchUserAchievements(supabase, user.id),
        fetchUserAchievementProgress(supabase, user.id),
      ])
      setData(result)
      setProgressRows(progress)
      enqueueFromAchievementsData(result)
      if (result.error && result.achievements.length === 0) {
        setLoadError(result.error)
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Could not load achievements.',
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id, enqueueFromAchievementsData])

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      setData(null)
      setProgressRows([])
      setLoading(false)
      return
    }
    void load()
  }, [authLoading, user?.id, load, reloadKey])

  useEffect(() => {
    if (authLoading || loading || !user?.id) return
    capturePostHog('achievements_viewed', {
      earned_count: data?.earnedCount ?? 0,
      total_count: data?.totalCount ?? 0,
    })
  }, [authLoading, loading, user?.id, data?.earnedCount, data?.totalCount])

  const progressById = useMemo(
    () =>
      new Map(progressRows.map((row) => [row.achievement_id, row] as const)),
    [progressRows],
  )

  const groups = useMemo(
    () => groupAchievementsForDisplay(data?.achievements ?? []),
    [data?.achievements],
  )

  const selectedBadge =
    data?.achievements.find((badge) => badge.id === selectedId) ?? null

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
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground',
              FOCUS_VISIBLE_RING,
            )}
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
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground',
                FOCUS_VISIBLE_RING,
              )}
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
          <p className="font-mono text-2xl tracking-wide tabular-nums text-foreground">
            {earned}
            <span className="text-muted-foreground"> / {total}</span>
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            Earned · {overallPct}%
          </p>
        </div>
      </div>

      {earned === 0 && groups.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-border bg-card/40 px-4 py-4 text-center sm:text-left">
          <p className="text-sm font-medium text-foreground">
            No badges unlocked yet — you&apos;re just getting started
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Make predictions, join a pool, or say hi in chat. Tap any badge to
            see what it takes.
          </p>
        </div>
      ) : null}

      {loadError && groups.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/70 px-4 py-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            className={cn('mt-4', FOCUS_VISIBLE_RING)}
            onClick={() => setReloadKey((n) => n + 1)}
          >
            Try again
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
          <p className="font-display text-2xl tracking-wide text-foreground">
            Your badge shelf is ready
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Make predictions, join a pool, and chat with your squad — badges
            unlock as you play. Tap any badge to see what it takes.
          </p>
          <Button
            type="button"
            className={cn('mt-5', FOCUS_VISIBLE_RING)}
            onClick={() => setReloadKey((n) => n + 1)}
          >
            Refresh
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3 border-b border-white/8 pb-1">
                <h2 className="font-display text-2xl tracking-wide text-foreground">
                  {group.label}
                </h2>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {group.earnedCount}/{group.totalCount}
                </p>
              </div>

              {/* Mobile: horizontal scroller */}
              <div
                className={cn(
                  '-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:-mx-6 sm:px-6 md:hidden',
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
                        onOpen={(b) => setSelectedId(b.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop: responsive grid */}
              <div
                className="hidden grid-cols-3 gap-3 md:grid lg:grid-cols-4 xl:grid-cols-5"
                role="list"
                aria-label={`${group.label} badges`}
              >
                {group.badges.map((badge) => (
                  <div key={badge.id} role="listitem" className="min-w-0">
                    <BadgeCard
                      badge={badge}
                      progress={progressById.get(badge.id) ?? null}
                      onOpen={(b) => setSelectedId(b.id)}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <BadgeDetailModal
        badge={selectedBadge}
        progress={
          selectedBadge
            ? (progressById.get(selectedBadge.id) ?? null)
            : null
        }
        onDismiss={() => setSelectedId(null)}
      />
    </main>
  )
}
