'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'
import {
  fetchUserAchievements,
  type AchievementWithStatus,
  type UserAchievementsData,
} from '@/src/lib/fetch-user-achievements'
import { xpToLevel } from '@/src/lib/levels'

function BadgeCard({ badge }: { badge: AchievementWithStatus }) {
  const xpLabel =
    badge.buildable === 'yellow'
      ? 'Soon'
      : badge.earned
        ? `+${badge.xp_value} XP`
        : `${badge.xp_value} XP`

  return (
    <article className="relative flex h-[9.75rem] w-[8.25rem] shrink-0 flex-col items-center pt-1 text-center sm:h-[10.25rem] sm:w-[9rem]">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center sm:h-16 sm:w-16">
        <div
          className={cn(
            'relative h-full w-full',
            !badge.earned && 'opacity-40 grayscale',
          )}
        >
          {/* Placeholder art — swap per-badge imageUrl when real assets land */}
          <Image
            src={badge.imageUrl}
            alt=""
            width={64}
            height={64}
            className="h-full w-full object-contain"
            unoptimized
          />
        </div>

        <span
          className={cn(
            'absolute -right-3 -top-1 z-10 max-w-[4.5rem] truncate rounded-full px-1.5 py-0.5 text-[8px] font-bold leading-none tabular-nums shadow-[0_2px_8px_rgba(0,0,0,0.35)]',
            badge.earned
              ? 'bg-primary text-primary-foreground'
              : badge.buildable === 'yellow'
                ? 'border border-white/10 bg-background/90 text-muted-foreground/70'
                : 'border border-primary/30 bg-primary/15 text-primary/80',
          )}
        >
          {xpLabel}
        </span>

        {!badge.earned ? (
          <span
            className="absolute -bottom-0.5 -left-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-white/10 bg-background/85 text-muted-foreground"
            aria-label="Locked"
          >
            <Lock className="h-2 w-2" aria-hidden />
          </span>
        ) : null}
      </div>

      <h3
        className={cn(
          'mt-1 line-clamp-2 min-h-[1.75rem] w-full text-xs font-semibold leading-tight',
          badge.earned ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {badge.name}
      </h3>
      <p
        className={cn(
          'mt-0.5 line-clamp-3 min-h-[2.4rem] w-full text-[10px] leading-snug',
          badge.earned ? 'text-muted-foreground' : 'text-muted-foreground/70',
        )}
      >
        {badge.description}
      </p>
    </article>
  )
}

export function AchievementsPageView() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<UserAchievementsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      setData(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void fetchUserAchievements(supabase, user.id).then((result) => {
      if (cancelled) return
      setData(result)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, user?.id])

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
  const groups = data?.groups ?? []

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
            Earned
          </p>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {data?.error ?? 'No achievements found.'}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.category} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3 border-b border-white/8 pb-1.5">
                <h2 className="font-display text-2xl tracking-wide text-foreground">
                  {group.category}
                </h2>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {group.badges.filter((badge) => badge.earned).length}/
                  {group.badges.length}
                </p>
              </div>
              <div
                className={cn(
                  '-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:-mx-6 sm:px-6',
                  'scrollbar-none',
                )}
                role="list"
                aria-label={`${group.category} badges`}
              >
                <div className="flex w-max gap-3 pr-8 sm:gap-4 sm:pr-12">
                  {group.badges.map((badge) => (
                    <div key={badge.id} role="listitem">
                      <BadgeCard badge={badge} />
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
