'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Award,
  Flame,
  LockKeyholeOpen,
  Loader2,
  Sparkles,
  Trophy,
} from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { Button } from '@/components/ui/button'
import { supabase } from '@/src/lib/supabase'
import {
  fetchUserAchievements,
  type UserAchievementsData,
} from '@/src/lib/fetch-user-achievements'
import { xpToLevel } from '@/src/lib/levels'

type AchievementsSectionProps = {
  userId: string
}

/**
 * PLACEHOLDER: No streak tracker yet. Replace when engagement streaks ship.
 */
const PLACEHOLDER_STREAK_DAYS = 7

/**
 * PLACEHOLDER: Closest next GREEN badge needs live metric progress (not just
 * catalogue thresholds). Keep until a progress RPC / client stats helper lands.
 */
const PLACEHOLDER_NEXT_ACHIEVEMENT = {
  name: 'Next badge',
  message: 'Progress toward your next achievement coming soon.',
} as const

function CompactStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Award
  value: string | number
  label: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/45 px-2.5 py-3 text-center shadow-[0_8px_24px_rgba(0,0,0,0.18),0_1px_0_rgba(255,255,255,0.04)_inset] sm:px-3">
      <Icon className="mx-auto h-4 w-4 text-primary" aria-hidden />
      <p className="mt-1.5 font-display text-2xl leading-none tracking-wide tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

export function AchievementsSection({ userId }: AchievementsSectionProps) {
  const [data, setData] = useState<UserAchievementsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setData(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void fetchUserAchievements(supabase, userId).then((result) => {
      if (cancelled) return
      setData(result)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  const level = data?.level ?? xpToLevel(0)
  const totalXp = data?.totalXp ?? 0
  const earnedCount = data?.earnedCount ?? 0
  const recent = data?.recentlyUnlocked ?? []

  return (
    <DashboardFeedSection id="achievements" title="Achievements">
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2
              className="h-6 w-6 animate-spin text-primary"
              aria-label="Loading achievements"
            />
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">
              Level {level.level}
              <span className="mx-2 text-border">•</span>
              {PLACEHOLDER_STREAK_DAYS}-Day Streak
              <span className="text-[10px] font-normal text-muted-foreground">
                {' '}
                (placeholder)
              </span>
              <span className="mx-2 text-border">•</span>
              {earnedCount} Badges
            </p>

            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-[radial-gradient(circle_at_15%_15%,rgba(0,230,118,0.2),transparent_38%),linear-gradient(135deg,rgba(17,26,39,0.98),rgba(8,11,15,0.97))] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.32),0_1px_0_rgba(255,255,255,0.06)_inset] sm:p-5">
              <div
                className="absolute -bottom-14 -right-10 h-36 w-36 rounded-full border border-primary/10 bg-primary/5"
                aria-hidden
              />
              <div className="relative flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                    Current level
                  </p>
                  <p className="mt-1 font-display text-6xl leading-none tracking-tight tabular-nums text-foreground">
                    {level.level}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl tracking-wide tabular-nums text-foreground sm:text-3xl">
                    {totalXp.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">total XP</p>
                </div>
              </div>

              <div className="relative mt-5">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-foreground">
                    {level.nextLevelThreshold == null
                      ? 'Top level reached'
                      : `${level.xpToNext.toLocaleString()} XP to Level ${level.level + 1}`}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {level.progressPct}%
                  </span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/35"
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
                    className="h-full rounded-full bg-[linear-gradient(90deg,#00b85f,#00e676)] shadow-[0_0_16px_rgba(0,230,118,0.45)]"
                    style={{ width: `${level.progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <CompactStat icon={Trophy} value={level.level} label="Level" />
              <CompactStat
                icon={Flame}
                value={`${PLACEHOLDER_STREAK_DAYS}d`}
                label="Streak*"
              />
              <CompactStat
                icon={Award}
                value={earnedCount}
                label="Badges"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              * Streak is a placeholder — no streak system yet.
            </p>

            <div className="rounded-2xl border border-white/10 bg-card/85 p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.22),0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <LockKeyholeOpen
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden
                  />
                  Recently unlocked
                </p>
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                  <Link href="/achievements">
                    View collection
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>

              {recent.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No badges unlocked yet — earn XP by completing achievements.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {recent.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-background/40 p-2.5"
                    >
                      <Image
                        src={badge.imageUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 object-contain"
                        unoptimized
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {badge.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          +{badge.xp_value} XP
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(115deg,rgba(0,230,118,0.1),rgba(17,26,39,0.92)_45%,rgba(17,26,39,0.98))] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Next achievement
                <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground">
                  (placeholder)
                </span>
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {PLACEHOLDER_NEXT_ACHIEVEMENT.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {PLACEHOLDER_NEXT_ACHIEVEMENT.message}
              </p>
            </div>
          </>
        )}
      </div>
    </DashboardFeedSection>
  )
}
