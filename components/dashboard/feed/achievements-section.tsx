'use client'

import { Award, Flame, Star } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'

/**
 * TODO(mock): Replace with real badges / streak milestones / level XP.
 */
const MOCK_ACHIEVEMENTS = {
  newBadges: [
    { id: 'exact-5', label: 'Sharpshooter', detail: '5 exact scores' },
    { id: 'pool-host', label: 'Pool Host', detail: 'Created a pool' },
  ],
  streakMilestone: { days: 7, label: 'Week warrior' },
  level: { current: 4, progressPct: 62, nextLabel: 'Level 5' },
} as const

export function AchievementsSection() {
  const mock = MOCK_ACHIEVEMENTS

  return (
    <DashboardFeedSection id="achievements" title="Achievements">
      <DashboardPlainCard>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/40 p-3 sm:col-span-2">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Award className="h-3.5 w-3.5 text-primary" aria-hidden />
              New badges
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {mock.newBadges.map((badge) => (
                <li
                  key={badge.id}
                  className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background/40 px-3 py-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Star className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {badge.label}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {badge.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-3.5 text-center shadow-[0_0_0_1px_rgba(0,230,118,0.08)_inset] sm:py-4">
              <Flame className="mx-auto h-5 w-5 text-primary" aria-hidden />
              <p className="mt-2 font-display text-2xl leading-none tracking-wide tabular-nums text-foreground sm:text-3xl">
                {mock.streakMilestone.days}d
              </p>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Streak · {mock.streakMilestone.label}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-3.5 text-center shadow-[0_0_0_1px_rgba(0,230,118,0.08)_inset] sm:py-4">
              <Award className="mx-auto h-5 w-5 text-primary" aria-hidden />
              <p className="mt-2 font-display text-2xl leading-none tracking-wide tabular-nums text-foreground sm:text-3xl">
                {mock.level.current}
              </p>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Level
              </p>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={mock.level.progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress to ${mock.level.nextLabel}`}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${mock.level.progressPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {mock.level.progressPct}% to {mock.level.nextLabel}
              </p>
            </div>
          </div>
        </div>
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
