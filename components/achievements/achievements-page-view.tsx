'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getAchievementSummary,
  getAchievementsGroupedByCategory,
  type AchievementWithStatus,
} from '@/src/lib/achievements-catalogue'

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
      </div>
    </article>
  )
}

/**
 * Achievements / badges page shell.
 *
 * Earned vs locked is currently FAKE — a hardcoded placeholder set in
 * `PLACEHOLDER_EARNED_ACHIEVEMENT_IDS`. Replace with real `user_achievements`
 * data when tracking ships; do not treat this as production progress.
 */
export function AchievementsPageView() {
  // TODO(tracking): replace with the signed-in user's earned achievement IDs.
  const groups = getAchievementsGroupedByCategory()
  const summary = getAchievementSummary()

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
            Your badges — earned and locked. Art and awarding logic come later;
            this is the catalogue shell.
          </p>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm">
          <p className="font-display text-2xl tracking-wide tabular-nums text-foreground">
            {summary.earned}
            <span className="text-muted-foreground"> / {summary.total}</span>
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            Earned (placeholder)
          </p>
        </div>
      </div>

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
    </main>
  )
}
