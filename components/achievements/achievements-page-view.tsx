'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  return (
    <article
      className={cn(
        'relative flex flex-col items-center gap-3 rounded-2xl border px-3 py-4 text-center',
        'shadow-[0_12px_32px_rgba(0,0,0,0.22),0_1px_0_rgba(255,255,255,0.04)_inset]',
        badge.earned
          ? 'border-primary/25 bg-card/90'
          : 'border-white/8 bg-card/50',
      )}
    >
      {!badge.earned ? (
        <span
          className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-background/70 text-muted-foreground"
          aria-label="Locked"
        >
          <Lock className="h-3 w-3" aria-hidden />
        </span>
      ) : null}

      <div
        className={cn(
          'relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20',
          !badge.earned && 'opacity-40 grayscale',
        )}
      >
        {/* Placeholder art — swap per-badge imageUrl when real assets land */}
        <Image
          src={badge.imageUrl}
          alt=""
          width={80}
          height={80}
          className="h-full w-full object-contain"
          unoptimized
        />
      </div>

      <div className="min-w-0 space-y-1">
        <h3
          className={cn(
            'text-sm font-semibold leading-snug',
            badge.earned ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {badge.name}
        </h3>
        <p
          className={cn(
            'line-clamp-3 text-[11px] leading-relaxed sm:text-xs',
            badge.earned ? 'text-muted-foreground' : 'text-muted-foreground/70',
          )}
        >
          {badge.description}
        </p>
        {badge.tier ? (
          <p
            className={cn(
              'pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
              badge.earned ? 'text-primary/80' : 'text-muted-foreground/60',
            )}
          >
            {badge.tier}
          </p>
        ) : null}
        {badge.earned ? (
          <p className="pt-0.5 text-[10px] tabular-nums text-primary/70">
            +{badge.xp_value} XP
          </p>
        ) : badge.buildable === 'yellow' ? (
          <p className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
            Coming soon
          </p>
        ) : (
          <p className="pt-0.5 text-[10px] tabular-nums text-muted-foreground/50">
            {badge.xp_value} XP
          </p>
        )}
      </div>
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
        <Button asChild variant="outline" size="sm" className="w-fit gap-1.5">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to dashboard
          </Link>
        </Button>
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
          <Button asChild variant="outline" size="sm" className="w-fit gap-1.5">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to dashboard
            </Link>
          </Button>
          <h1 className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
            Achievements
          </h1>
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
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.category} className="space-y-4">
              <div className="flex items-baseline justify-between gap-3 border-b border-white/8 pb-2">
                <h2 className="font-display text-2xl tracking-wide text-foreground">
                  {group.category}
                </h2>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {group.badges.filter((badge) => badge.earned).length}/
                  {group.badges.length}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {group.badges.map((badge) => (
                  <BadgeCard key={badge.id} badge={badge} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
