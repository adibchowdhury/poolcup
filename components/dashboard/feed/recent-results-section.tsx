'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Crown, Flame, Sparkles, TrendingUp } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { AchievementsFeedContent } from '@/components/dashboard/feed/achievements-section'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { useXpFeedbackOptional } from '@/components/xp/xp-feedback-provider'
import { cn } from '@/lib/utils'
import {
  fetchRecentResultsFeed,
  type BestPrediction,
  type RecentResultsFeedData,
  type RecentScoredPrediction,
} from '@/src/lib/fetch-recent-results-feed'
import {
  fetchUserGlobalRank,
  type UserGlobalRank,
} from '@/src/lib/global-rank'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import type { PredictionStreak } from '@/src/lib/prediction-streak'
import type { PredictionOutcomeKind } from '@/src/lib/prediction-scoring'
import { capturePostHog } from '@/src/lib/posthog-client'
import {
  applyStreakSyncFeedback,
  syncPredictionStreak,
} from '@/src/lib/streak-client'
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

function GlobalRankChip({ rank }: { rank: UserGlobalRank }) {
  if (rank.global_rank == null || rank.total_ranked <= 0) return null

  return (
    <Link
      href="/leaderboard"
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card/95 px-2.5 py-1 text-[11px] shadow-sm transition-colors hover:border-primary/40 hover:bg-card',
        FOCUS_VISIBLE_RING,
      )}
      aria-label={`Global rank ${rank.global_rank} of ${rank.total_ranked}`}
    >
      <Crown className="h-3 w-3 shrink-0 text-primary" aria-hidden />
      <span className="font-display tracking-wide text-foreground">
        Global rank #{rank.global_rank.toLocaleString()}
        <span className="ml-1 font-sans font-normal text-muted-foreground">
          of {rank.total_ranked.toLocaleString()}
        </span>
      </span>
    </Link>
  )
}

function StreakStatusLine({ streak }: { streak: PredictionStreak }) {
  if (streak.today_is_open && streak.today_predicted) {
    return (
      <p className="text-[11px] text-primary">
        Streak secured for today
      </p>
    )
  }
  if (streak.today_is_open && !streak.today_predicted) {
    return (
      <p className="text-[11px] text-amber-300/95">
        {streak.current_streak > 0
          ? '🔥 Predict today to keep your streak'
          : '🔥 Predict today to start a streak'}
      </p>
    )
  }
  if (streak.current_streak === 0 && streak.longest_streak === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Start your streak — predict today!
      </p>
    )
  }
  if (streak.current_streak === 0 && streak.longest_streak > 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Streak broken — predict on a match day to start again
      </p>
    )
  }
  return null
}

function PointsHero({
  points,
  accuracy,
  streak,
  streakLoading,
  streakError,
  onRetryStreak,
  globalRank,
}: {
  points: number
  accuracy: string
  streak: PredictionStreak | null
  streakLoading: boolean
  streakError: string | null
  onRetryStreak: () => void
  globalRank: UserGlobalRank | null
}) {
  const current = streak?.current_streak ?? 0

  return (
    <div className={cn(SURFACE, 'px-3.5 py-3 sm:px-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Total points
          </p>
          <p className="mt-1 font-display text-4xl leading-none tracking-tight tabular-nums text-foreground sm:text-5xl">
            {points.toLocaleString()}
          </p>
        </div>
        {globalRank ? <GlobalRankChip rank={globalRank} /> : null}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <InlineStat icon={TrendingUp} label="Accuracy" value={accuracy} />
        {streakLoading && !streak ? (
          <ShimmerBlock className="h-7 w-24 rounded-md" />
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-orange-400/25 bg-orange-400/[0.08] px-2 py-1 text-[11px] text-orange-200"
            aria-label={`Current prediction streak ${current} days`}
          >
            <Flame className="h-3 w-3 shrink-0 text-orange-300" aria-hidden />
            <span className="font-medium uppercase tracking-[0.08em]">
              Streak
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {current}
            </span>
          </span>
        )}
      </div>
      <div className="mt-2 min-h-[1rem]">
        {streakError && !streak ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] text-destructive">{streakError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('h-7 px-2 text-[11px]', FOCUS_VISIBLE_RING)}
              onClick={onRetryStreak}
            >
              Retry
            </Button>
          </div>
        ) : streak ? (
          <StreakStatusLine streak={streak} />
        ) : null}
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
    <li>
      <Link
        href={`/match/${item.matchId}`}
        className={cn(
          'flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/40',
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
  const xp = useXpFeedbackOptional()
  const [data, setData] = useState<RecentResultsFeedData | null>(null)
  const [globalRank, setGlobalRank] = useState<UserGlobalRank | null>(null)
  const [loading, setLoading] = useState(true)
  const [achievementsEmpty, setAchievementsEmpty] = useState(false)
  const [streak, setStreak] = useState<PredictionStreak | null>(null)
  const [streakLoading, setStreakLoading] = useState(true)
  const [streakError, setStreakError] = useState<string | null>(null)
  const [streakReloadKey, setStreakReloadKey] = useState(0)
  const viewedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [next, rank] = await Promise.all([
      fetchRecentResultsFeed(supabase, userId),
      fetchUserGlobalRank(supabase, userId),
    ])
    setData(next)
    setGlobalRank(rank)
    setLoading(false)
  }, [userId])

  const loadStreak = useCallback(async () => {
    setStreakLoading(true)
    setStreakError(null)
    const result = await syncPredictionStreak()
    if (!result || result.error) {
      setStreakError(result?.error ?? 'Could not load streak')
      setStreakLoading(false)
      return
    }
    setStreak({
      current_streak: result.current_streak,
      longest_streak: result.longest_streak,
      last_predicted_day: result.last_predicted_day,
      today_is_eligible: result.today_is_eligible,
      today_is_open: result.today_is_open,
      today_predicted: result.today_predicted,
    })
    applyStreakSyncFeedback(result, {
      onLevelUp: xp?.enqueueLevelUp,
    })
    if (!viewedRef.current) {
      viewedRef.current = true
      capturePostHog('streak_viewed', {
        current_streak: result.current_streak,
        longest_streak: result.longest_streak,
        surface: 'dashboard',
      })
    }
    setStreakLoading(false)
  }, [xp?.enqueueLevelUp])

  const handleAchievementsEmpty = useCallback((empty: boolean) => {
    setAchievementsEmpty(empty)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadStreak()
  }, [loadStreak, streakReloadKey])

  const predictionStreak = streak?.current_streak ?? 0
  const hasRank =
    globalRank?.global_rank != null && (globalRank.total_ranked ?? 0) > 0
  const recentScored = data?.recentScored ?? []
  const showRecentScored = recentScored.length > 0
  const showPointsHero = Boolean(
    (data && (!data.isEmpty || hasRank)) || streak || streakLoading || streakError,
  )
  const showProgressBody =
    showPointsHero ||
    Boolean(data?.bestPrediction) ||
    showRecentScored ||
    !achievementsEmpty

  if (
    !loading &&
    !streakLoading &&
    data &&
    !data.error &&
    !showProgressBody &&
    !hasRank &&
    !streakError
  ) {
    return null
  }

  return (
    <DashboardFeedSection id="your-progress" title="Your Progress">
      <div className="flex flex-col gap-2.5">
        {loading && !data && streakLoading && !streak ? (
          <ProgressSkeleton />
        ) : data?.error && data.isEmpty && !hasRank && !streak ? (
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
            {showPointsHero && (data || streak || streakLoading || streakError) ? (
              <PointsHero
                points={data?.totalPoints ?? 0}
                accuracy={
                  data?.winRate != null ? `${data.winRate}%` : '—'
                }
                streak={streak}
                streakLoading={streakLoading}
                streakError={streakError}
                onRetryStreak={() => setStreakReloadKey((n) => n + 1)}
                globalRank={hasRank ? globalRank : null}
              />
            ) : hasRank && globalRank ? (
              <div className={cn(SURFACE, 'px-3.5 py-3')}>
                <GlobalRankChip rank={globalRank} />
              </div>
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
              predictionStreak={predictionStreak}
              onEmptyChange={handleAchievementsEmpty}
            />
          </>
        )}
      </div>
    </DashboardFeedSection>
  )
}
