'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  Flame,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { ordinalPlace } from '@/components/pool/leaderboard-grouped-list'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import { formatPointsDelta } from '@/src/lib/points-transaction-feed'
import {
  fetchRecentResultsFeed,
  type BestPrediction,
  type RecentResultsFeedData,
} from '@/src/lib/fetch-recent-results-feed'
import { supabase } from '@/src/lib/supabase'

type RecentResultsSectionProps = {
  userId: string
}

function StatChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Zap
  label: string
  value: string
  tone?: 'default' | 'good' | 'warn'
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-3.5 text-center sm:py-4',
        tone === 'good' &&
          'border-emerald-500/35 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset]',
        tone === 'warn' &&
          'border-[#ffb300]/35 bg-[#ffb300]/10 shadow-[0_0_0_1px_rgba(255,179,0,0.08)_inset]',
        (!tone || tone === 'default') &&
          'border-primary/30 bg-primary/10 shadow-[0_0_0_1px_rgba(0,230,118,0.08)_inset]',
      )}
    >
      <Icon
        className={cn(
          'mx-auto h-5 w-5',
          tone === 'good' && 'text-emerald-400',
          tone === 'warn' && 'text-[#ffb300]',
          (!tone || tone === 'default') && 'text-primary',
        )}
        aria-hidden
      />
      <p className="mt-2 font-display text-2xl leading-none tracking-wide tabular-nums text-foreground sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

/**
 * TODO(mock): Replace with real streak from predictions / points history.
 * Shape: { currentStreak: number; streakActive: boolean }
 */
const MOCK_STREAK = {
  currentStreak: 4,
  streakActive: true,
} as const

function BestPredictionCard({ best }: { best: BestPrediction }) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-3 sm:px-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Best prediction
      </div>
      {best.kind === 'match' ? (
        <div className="mt-2 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {best.label}
            <span className="ml-2 font-mono text-primary">
              +{best.points} pts
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {best.team1Name} {best.resultTeam1}–{best.resultTeam2}{' '}
            {best.team2Name}
          </p>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            Your pick {best.predTeam1}–{best.predTeam2}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm font-semibold text-foreground">
          {best.summary}
        </p>
      )}
    </div>
  )
}

function RecentResultsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ShimmerBlock className="h-[88px] rounded-xl" />
        <ShimmerBlock className="h-[88px] rounded-xl" />
        <ShimmerBlock className="h-[88px] rounded-xl" />
        <ShimmerBlock className="h-[88px] rounded-xl" />
      </div>
      <ShimmerBlock className="h-20 w-full rounded-xl" />
      <ShimmerBlock className="h-24 w-full rounded-xl" />
    </div>
  )
}

export function RecentResultsSection({ userId }: RecentResultsSectionProps) {
  const [data, setData] = useState<RecentResultsFeedData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const next = await fetchRecentResultsFeed(supabase, userId)
    setData(next)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <DashboardFeedSection id="your-progress" title="Your Progress">
      <DashboardPlainCard>
        {loading && !data ? (
          <RecentResultsSkeleton />
        ) : data?.error && !data.recentEvents.length && data.isEmpty ? (
          <div className="space-y-3 py-2 text-center">
            <p className="text-sm text-destructive">{data.error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        ) : data?.isEmpty ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip icon={Zap} label="Recent pts" value="—" />
              <StatChip icon={TrendingUp} label="Accuracy" value="—" tone="warn" />
              <StatChip icon={Target} label="Correct" value="—" />
              <StatChip
                icon={Flame}
                label="Streak"
                value={
                  MOCK_STREAK.streakActive
                    ? `${MOCK_STREAK.currentStreak}d`
                    : '0'
                }
                tone={MOCK_STREAK.streakActive ? 'warn' : 'default'}
              />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              No scored results yet. Once matches finish, your points, accuracy,
              and best picks will show up here.
            </p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip
                icon={Zap}
                label="Recent pts"
                value={formatPointsDelta(data.recentPointsTotal)}
                tone={data.recentPointsTotal > 0 ? 'good' : 'default'}
              />
              <StatChip
                icon={TrendingUp}
                label="Accuracy"
                value={data.winRate != null ? `${data.winRate}%` : '—'}
                tone="warn"
              />
              <StatChip
                icon={Target}
                label="Correct"
                value={
                  data.settledPredictions > 0
                    ? `${data.correctPredictions}/${data.settledPredictions}`
                    : '—'
                }
              />
              <StatChip
                icon={Flame}
                label="Streak"
                value={
                  MOCK_STREAK.streakActive
                    ? `${MOCK_STREAK.currentStreak}d`
                    : '0'
                }
                tone={MOCK_STREAK.streakActive ? 'warn' : 'default'}
              />
            </div>

            {data.bestPrediction ? (
              <BestPredictionCard best={data.bestPrediction} />
            ) : null}

            {data.rankChanges.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Rank changes
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Since last scored update in each pool
                </p>
                <ul className="mt-2 space-y-2">
                  {data.rankChanges.map((row) => (
                    <li
                      key={row.poolId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <Link
                        href={`/pool/${row.inviteCode}`}
                        className="min-w-0 truncate text-xs font-medium text-foreground hover:text-primary"
                      >
                        {row.poolName}
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums">
                          <Trophy
                            className="h-3 w-3 text-[#ffb300]"
                            aria-hidden
                          />
                          {row.yourRank != null
                            ? ordinalPlace(row.yourRank)
                            : '—'}
                        </span>
                        {row.movement === 'up' ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400">
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                            {row.rankDelta}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-400">
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                            {row.rankDelta}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.recentEvents.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Recent points
                </p>
                <ul className="mt-2 divide-y divide-border/50">
                  {data.recentEvents.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">
                          {event.description}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {event.relativeTime}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 font-mono text-xs font-semibold tabular-nums',
                          event.points >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400',
                        )}
                      >
                        {formatPointsDelta(event.points)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.error ? (
              <p className="text-[11px] text-muted-foreground">
                Some pool standings may be incomplete: {data.error}
              </p>
            ) : null}
          </div>
        ) : null}
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
