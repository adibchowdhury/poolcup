'use client'

import { useCallback, useEffect, useState } from 'react'
import { Flame, Sparkles, TrendingUp } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { AchievementsFeedContent } from '@/components/dashboard/feed/achievements-section'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import {
  fetchRecentResultsFeed,
  type BestPrediction,
  type RecentResultsFeedData,
} from '@/src/lib/fetch-recent-results-feed'
import { supabase } from '@/src/lib/supabase'

type RecentResultsSectionProps = {
  userId: string
}

const SURFACE =
  'rounded-xl border border-border/90 bg-card/90'

function InlineStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0 text-primary" aria-hidden />
      <span className="font-medium uppercase tracking-[0.08em]">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{value}</span>
    </span>
  )
}

function PointsHero({
  points,
  accuracy,
  streak,
}: {
  points: number
  accuracy: string
  streak: string
}) {
  return (
    <div className={cn(SURFACE, 'px-3.5 py-3 sm:px-4')}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Total points
      </p>
      <p className="mt-1 font-display text-4xl leading-none tracking-tight tabular-nums text-foreground sm:text-5xl">
        {points.toLocaleString()}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <InlineStat icon={TrendingUp} label="Accuracy" value={accuracy} />
        <InlineStat icon={Flame} label="Streak" value={streak} />
      </div>
    </div>
  )
}

function BestPredictionRow({ best }: { best: BestPrediction }) {
  const line =
    best.kind === 'match'
      ? `${best.label} · ${best.team1Name} ${best.resultTeam1}–${best.resultTeam2} ${best.team2Name} (pick ${best.predTeam1}–${best.predTeam2})`
      : best.summary

  return (
    <div
      className={cn(
        SURFACE,
        'flex min-w-0 items-center gap-2 px-3 py-2 sm:gap-2.5',
      )}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Best
      </span>
      <p className="min-w-0 flex-1 truncate text-sm text-foreground">{line}</p>
      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-primary">
        +{best.points}
      </span>
    </div>
  )
}

function ProgressSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <ShimmerBlock className="h-[88px] w-full rounded-xl" />
      <ShimmerBlock className="h-9 w-full rounded-xl" />
      <ShimmerBlock className="h-[72px] w-full rounded-xl" />
      <ShimmerBlock className="h-11 w-full rounded-xl" />
      <ShimmerBlock className="h-10 w-full rounded-xl" />
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

  const predictionStreak = data?.currentStreak ?? 0

  return (
    <DashboardFeedSection id="your-progress" title="Your Progress">
      <div className="flex flex-col gap-2.5">
        {loading && !data ? (
          <ProgressSkeleton />
        ) : data?.error && data.isEmpty ? (
          <div className="space-y-2 py-1 text-center">
            <p className="text-sm text-destructive">{data.error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
            >
              Try again
            </Button>
            <AchievementsFeedContent
              userId={userId}
              predictionStreak={0}
            />
          </div>
        ) : (
          <>
            {data ? (
              <>
                <PointsHero
                  points={data.totalPoints}
                  accuracy={data.winRate != null ? `${data.winRate}%` : '—'}
                  streak={`${data.currentStreak}`}
                />

                {data.bestPrediction ? (
                  <BestPredictionRow best={data.bestPrediction} />
                ) : (
                  <div
                    className={cn(
                      SURFACE,
                      'border-dashed px-3 py-2 text-center text-xs text-muted-foreground',
                    )}
                  >
                    Best prediction appears after a scored result.
                  </div>
                )}

                {data.error ? (
                  <p className="text-[11px] text-muted-foreground">
                    Some progress data may be incomplete: {data.error}
                  </p>
                ) : null}
              </>
            ) : null}

            <AchievementsFeedContent
              userId={userId}
              predictionStreak={predictionStreak}
            />
          </>
        )}
      </div>
    </DashboardFeedSection>
  )
}
