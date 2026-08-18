'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, TrendingUp } from 'lucide-react'
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
  type RecentScoredPrediction,
} from '@/src/lib/fetch-recent-results-feed'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import type { PredictionOutcomeKind } from '@/src/lib/prediction-scoring'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { SignedShareButton } from '@/components/share/signed-share-button'

type RecentResultsSectionProps = {
  userId: string
}

const SURFACE =
  'rounded-xl border border-border/90 bg-card/90'

/** Deduplicate prediction_scored when users re-open the dashboard. */
const scoredSeenKeys = new Set<string>()

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
}: {
  points: number
  accuracy: string
}) {
  return (
    <div className={cn(SURFACE, 'px-3.5 py-3 sm:px-4')}>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Total points
        </p>
        <p className="mt-1 font-display text-4xl leading-none tracking-tight tabular-nums text-foreground sm:text-5xl">
          {points.toLocaleString()}
        </p>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <InlineStat icon={TrendingUp} label="Accuracy" value={accuracy} />
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

function OutcomePill({ kind }: { kind: PredictionOutcomeKind }) {
  const label =
    kind === 'exact'
      ? 'Exact'
      : kind === 'draw'
        ? 'Draw'
        : kind === 'winner'
          ? 'Winner'
          : 'Wrong'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        kind === 'exact' &&
          'border border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
        kind === 'draw' &&
          'border border-sky-500/40 bg-sky-500/15 text-sky-400',
        kind === 'winner' &&
          'border border-amber-500/40 bg-amber-500/15 text-amber-400',
        kind === 'wrong' &&
          'border border-destructive/40 bg-destructive/15 text-destructive',
      )}
    >
      {label}
    </span>
  )
}

function RecentScoredRow({ item }: { item: RecentScoredPrediction }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5 px-1.5 py-1 sm:gap-2 sm:px-2">
      <Link
        href={`/match/${item.matchId}`}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/40 sm:px-2.5',
          FOCUS_VISIBLE_RING,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {item.team1Name}{' '}
            <span className="font-mono tabular-nums text-muted-foreground">
              {item.resultTeam1}–{item.resultTeam2}
            </span>{' '}
            {item.team2Name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Pick{' '}
            <span className="font-mono tabular-nums text-foreground/80">
              {item.predTeam1}–{item.predTeam2}
            </span>
          </p>
        </div>
        <OutcomePill kind={item.outcomeKind} />
        <span
          className={cn(
            'shrink-0 font-mono text-xs font-semibold tabular-nums',
            item.points > 0 ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {item.points > 0 ? `+${item.points}` : '0'}
        </span>
      </Link>
      <SignedShareButton
        type="prediction"
        poolId={item.poolId}
        matchId={item.matchId}
        destinationUrl={`/match/${encodeURIComponent(item.matchId)}`}
        title={`${item.team1Name} vs ${item.team2Name} on PoolCup`}
        text={`My pick ${item.predTeam1}–${item.predTeam2} · Final ${item.resultTeam1}–${item.resultTeam2} · ${item.points > 0 ? `+${item.points}` : '0'} pts`}
        label="Share"
        variant="ghost"
        className="shrink-0"
      />
    </li>
  )
}

function RecentScoredList({ items }: { items: RecentScoredPrediction[] }) {
  if (items.length === 0) return null

  return (
    <div className={cn(SURFACE, 'overflow-hidden')}>
      <div className="border-b border-border/70 px-3.5 py-2 sm:px-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Recent results
        </p>
      </div>
      <ul
        className="divide-y divide-border/50"
        aria-label="Recent scored predictions"
      >
        {items.map((item) => (
          <RecentScoredRow key={item.matchId} item={item} />
        ))}
      </ul>
    </div>
  )
}

function ProgressSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <ShimmerBlock className="h-[88px] w-full rounded-xl" />
      <ShimmerBlock className="h-9 w-full rounded-xl" />
      <ShimmerBlock className="h-[120px] w-full rounded-xl" />
      <ShimmerBlock className="h-11 w-full rounded-xl" />
      <ShimmerBlock className="h-10 w-full rounded-xl" />
    </div>
  )
}

export function RecentResultsSection({ userId }: RecentResultsSectionProps) {
  const [data, setData] = useState<RecentResultsFeedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [achievementsEmpty, setAchievementsEmpty] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const next = await fetchRecentResultsFeed(supabase, userId)
    setData(next)
    setLoading(false)

    // Client-side surface for scored picks (scoring itself is server-side).
    for (const item of next.recentScored) {
      const key = `${item.poolId}:${item.matchId}`
      if (scoredSeenKeys.has(key)) continue
      scoredSeenKeys.add(key)
      try {
        const storageKey = `ph_prediction_scored:${key}`
        if (sessionStorage.getItem(storageKey)) continue
        sessionStorage.setItem(storageKey, '1')
      } catch {
        /* private mode — module Set still dedupes this session */
      }
      capturePostHog('prediction_scored', {
        match_id: item.matchId,
        pool_id: item.poolId,
        points: item.points,
        outcome: item.outcomeKind,
      })
    }
  }, [userId])

  const handleAchievementsEmpty = useCallback((empty: boolean) => {
    setAchievementsEmpty(empty)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const recentScored = data?.recentScored ?? []
  const showRecentScored = recentScored.length > 0
  const showPointsHero = Boolean(data && !data.isEmpty)
  const showProgressBody =
    showPointsHero ||
    Boolean(data?.bestPrediction) ||
    showRecentScored ||
    !achievementsEmpty

  if (!loading && data && !data.error && !showProgressBody) {
    return null
  }

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
              className={FOCUS_VISIBLE_RING}
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            {showPointsHero && data ? (
              <PointsHero
                points={data.totalPoints}
                accuracy={
                  data.winRate != null ? `${data.winRate}%` : '—'
                }
              />
            ) : null}

            {data?.bestPrediction ? (
              <BestPredictionRow best={data.bestPrediction} />
            ) : null}

            <RecentScoredList items={recentScored} />

            {data?.error ? (
              <p className="text-[11px] text-muted-foreground">
                Some progress data may be incomplete: {data.error}
              </p>
            ) : null}

            <AchievementsFeedContent
              userId={userId}
              onEmptyChange={handleAchievementsEmpty}
            />
          </>
        )}
      </div>
    </DashboardFeedSection>
  )
}
