'use client'

import { useCallback, useEffect, useState } from 'react'
import { Flame, Sparkles, TrendingUp, Zap } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import {
  fetchRecentResultsFeed,
  type BestPrediction,
  type RecentResultsFeedData,
} from '@/src/lib/fetch-recent-results-feed'
import { supabase } from '@/src/lib/supabase'

type RecentResultsSectionProps = {
  userId: string
}

function SupportingStat({
  icon: Icon,
  label,
  value,
  accent = 'primary',
}: {
  icon: typeof Zap
  label: string
  value: string
  accent?: 'primary' | 'flame'
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-background/55 px-3 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.2),0_1px_0_rgba(255,255,255,0.04)_inset] sm:px-4 sm:py-4">
      <div
        className={
          accent === 'flame'
            ? 'absolute -right-5 -top-5 h-16 w-16 rounded-full bg-[#ffb300]/10 blur-xl'
            : 'absolute -right-5 -top-5 h-16 w-16 rounded-full bg-primary/10 blur-xl'
        }
        aria-hidden
      />
      <Icon
        className={
          accent === 'flame'
            ? 'relative h-5 w-5 text-[#ffb300]'
            : 'relative h-5 w-5 text-primary'
        }
        aria-hidden
      />
      <p className="relative mt-3 font-display text-3xl leading-none tracking-wide tabular-nums text-foreground sm:text-4xl">
        {value}
      </p>
      <p className="relative mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function PointsHero({ points }: { points: number }) {
  return (
    <div className="relative min-h-44 overflow-hidden rounded-2xl border border-primary/25 bg-[radial-gradient(circle_at_15%_20%,rgba(0,230,118,0.18),transparent_42%),linear-gradient(135deg,rgba(17,26,39,0.98),rgba(8,11,15,0.96))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.35),0_1px_0_rgba(255,255,255,0.06)_inset] sm:min-h-48 sm:p-6">
      <div
        className="absolute -bottom-16 -right-12 h-44 w-44 rounded-full border border-primary/10 bg-primary/5 blur-sm"
        aria-hidden
      />
      <div className="relative flex h-full flex-col justify-between gap-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
            <Zap className="h-4 w-4" aria-hidden />
          </span>
          Total points
        </div>
        <div>
          <p className="font-display text-6xl leading-[0.82] tracking-tight tabular-nums text-foreground sm:text-7xl">
            {points.toLocaleString()}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Keep predicting. Every result moves your total.
          </p>
        </div>
      </div>
    </div>
  )
}

function BestPredictionCard({ best }: { best: BestPrediction }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(115deg,rgba(0,230,118,0.12),rgba(17,26,39,0.92)_42%,rgba(17,26,39,0.98))] px-4 py-4 shadow-[0_12px_35px_rgba(0,0,0,0.25),0_1px_0_rgba(255,255,255,0.05)_inset] sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          </span>
          Best prediction
        </div>
        <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-primary">
          +{best.points} pts
        </span>
      </div>
      {best.kind === 'match' ? (
        <div className="mt-3">
          <p className="text-base font-semibold text-foreground">
            {best.label}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {best.team1Name} {best.resultTeam1}–{best.resultTeam2}{' '}
            {best.team2Name}
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
            Your pick {best.predTeam1}–{best.predTeam2}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-foreground">
          {best.summary}
        </p>
      )}
    </div>
  )
}

function RecentResultsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(12rem,0.8fr)]">
        <ShimmerBlock className="h-44 rounded-2xl sm:h-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          <ShimmerBlock className="h-[82px] rounded-2xl sm:h-[90px]" />
          <ShimmerBlock className="h-[82px] rounded-2xl sm:h-[90px]" />
        </div>
      </div>
      <ShimmerBlock className="h-24 w-full rounded-2xl" />
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
        ) : data?.error && data.isEmpty ? (
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
        ) : data ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(12rem,0.8fr)]">
              <PointsHero points={data.totalPoints} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                <SupportingStat
                  icon={TrendingUp}
                  label="Accuracy"
                  value={data.winRate != null ? `${data.winRate}%` : '—'}
                />
                <SupportingStat
                  icon={Flame}
                  label="Current streak"
                  value={`${data.currentStreak}`}
                  accent="flame"
                />
              </div>
            </div>

            {data.bestPrediction ? (
              <BestPredictionCard best={data.bestPrediction} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-4 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Your best prediction will appear after a result is scored.
                </p>
              </div>
            )}

            {data.error ? (
              <p className="text-[11px] text-muted-foreground">
                Some progress data may be incomplete: {data.error}
              </p>
            ) : null}
          </div>
        ) : null}
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
