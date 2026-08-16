'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Trophy,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AiInsightsCard } from '@/components/analytics/ai-insights-card'
import { HistoricalPerformancePage } from '@/components/history/historical-performance-page'
import { LockedProFeature } from '@/components/pro/locked-pro-feature'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import {
  ANALYTICS_RANGE_OPTIONS,
  formatAccuracyPercent,
  formatBestRankLabel,
  formatPoints,
  formatSportLabel,
  parseAnalyticsRange,
  type AnalyticsBestRank,
  type AnalyticsComparisons,
  type AnalyticsRange,
  type AnalyticsTimeseries,
  type UserAnalytics,
} from '@/src/lib/analytics'

type AnalyticsApiOk = {
  isPro: true
  range: AnalyticsRange
  analytics: UserAnalytics
  comparisons: AnalyticsComparisons
  timeseries: AnalyticsTimeseries
  rank: AnalyticsBestRank
}

type AnalyticsApiLocked = {
  isPro: false
  locked: true
  error?: string
}

const accuracyChartConfig = {
  accuracy: { label: 'Accuracy', color: 'var(--chart-1)' },
} satisfies ChartConfig

const pointsChartConfig = {
  points: { label: 'Points', color: 'var(--chart-2)' },
} satisfies ChartConfig

const formChartConfig = {
  rolling_accuracy: {
    label: 'Rolling accuracy',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig

function rateToChartPercent(rate: number | null): number | null {
  if (rate == null || !Number.isFinite(rate)) return null
  return Math.round(rate * 1000) / 10
}

export function AnalyticsDashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const range = parseAnalyticsRange(searchParams.get('range'))
  const activeTab =
    searchParams.get('tab') === 'history' ? 'history' : 'performance'

  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [comparisons, setComparisons] =
    useState<AnalyticsComparisons | null>(null)
  const [timeseries, setTimeseries] = useState<AnalyticsTimeseries | null>(null)
  const [rank, setRank] = useState<AnalyticsBestRank | null>(null)

  const viewedOnce = useRef(false)
  const lastRangeEvent = useRef<string | null>(null)

  const setRange = useCallback(
    (next: AnalyticsRange) => {
      const qs = new URLSearchParams(searchParams.toString())
      if (next === '30d') qs.delete('range')
      else qs.set('range', next)
      const s = qs.toString()
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const setTab = useCallback(
    (next: 'performance' | 'history') => {
      const qs = new URLSearchParams(searchParams.toString())
      if (next === 'performance') qs.delete('tab')
      else qs.set('tab', 'history')
      const s = qs.toString()
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (range !== '30d') qs.set('range', range)
      const suffix = qs.toString()
      const res = await fetch(
        `/api/analytics${suffix ? `?${suffix}` : ''}`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
        },
      )
      if (res.status === 401) {
        router.replace('/login?next=/analytics')
        return
      }
      const json = (await res.json()) as AnalyticsApiOk | AnalyticsApiLocked & {
        error?: string
      }

      if (res.status === 403 || (json as AnalyticsApiLocked).locked) {
        setLocked(true)
        setAnalytics(null)
        setComparisons(null)
        setTimeseries(null)
        setRank(null)
        if (!viewedOnce.current) {
          viewedOnce.current = true
          capturePostHog('analytics_dashboard_viewed', { is_pro: false })
        }
        return
      }

      if (!res.ok) {
        throw new Error(
          (json as { error?: string }).error || 'Failed to load analytics',
        )
      }

      const ok = json as AnalyticsApiOk
      setLocked(false)
      setAnalytics(ok.analytics)
      setComparisons(ok.comparisons)
      setTimeseries(ok.timeseries)
      setRank(ok.rank)

      if (!viewedOnce.current) {
        viewedOnce.current = true
        capturePostHog('analytics_dashboard_viewed', {
          is_pro: true,
          range: ok.range,
          finalized: ok.analytics.finalized_predictions,
        })
      }
      if (lastRangeEvent.current !== range) {
        if (lastRangeEvent.current != null) {
          capturePostHog('analytics_range_changed', { range })
        }
        lastRangeEvent.current = range
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }, [range, router])

  useEffect(() => {
    void load()
  }, [load])

  const empty =
    !loading &&
    !locked &&
    !error &&
    analytics != null &&
    analytics.finalized_predictions === 0

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pro
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl tracking-wide text-foreground sm:text-4xl">
            <BarChart3
              className="h-7 w-7 shrink-0 text-muted-foreground"
              aria-hidden
            />
            Analytics
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Current form, AI insights, and historical season performance — all
            in one place.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className={FOCUS_VISIBLE_RING}>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setTab(value === 'history' ? 'history' : 'performance')
        }
        className="gap-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-0.5 rounded-xl border border-border/90 bg-card/90 p-1 sm:w-auto sm:min-w-[20rem]">
          <TabsTrigger
            value="performance"
            className={cn(
              'rounded-lg px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none',
              FOCUS_VISIBLE_RING,
            )}
          >
            Performance
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className={cn(
              'rounded-lg px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none',
              FOCUS_VISIBLE_RING,
            )}
          >
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-0 outline-none">
          {locked && !loading ? (
            <div className="space-y-4">
              <LockedProFeature
                title="AI Insights is a Pro feature"
                description="Get four personalized coaching tips from your own prediction stats — weekly summary, strengths, weak spots, and recent form."
                source="analytics_ai_insights"
                modalHeadline="Unlock AI Insights"
                onCtaClick={() => {
                  capturePostHog('insights_upgrade_prompt_clicked', {
                    source: 'analytics_ai_insights',
                  })
                }}
              />
              <LockedProFeature
                title="Advanced Analytics is a Pro feature"
                description="Unlock accuracy trends, sport and competition breakdowns, recent form, and comparisons vs PoolCup and friends."
                source="locked_analytics_dashboard"
              />
            </div>
          ) : (
            <>
              <div
                className="mb-5 flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Time range"
              >
                {ANALYTICS_RANGE_OPTIONS.map((opt) => {
                  const selected = range === opt.value
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      aria-pressed={selected}
                      title={opt.hint}
                      disabled={loading || locked}
                      className={cn('h-8', FOCUS_VISIBLE_RING)}
                      onClick={() => setRange(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  )
                })}
                {range === 'season' ? (
                  <p className="w-full text-[11px] text-muted-foreground sm:w-auto">
                    Current season (per sport)
                  </p>
                ) : null}
              </div>

              {error ? (
                <div
                  className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-center"
                  role="alert"
                >
                  <p className="text-sm text-foreground">{error}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn('mt-3', FOCUS_VISIBLE_RING)}
                    onClick={() => void load()}
                  >
                    Retry
                  </Button>
                </div>
              ) : loading ? (
                <AnalyticsSkeleton />
              ) : empty ? (
                <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No finalized predictions yet — make some predictions to see
                    your analytics
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className={cn('mt-3', FOCUS_VISIBLE_RING)}
                  >
                    <Link href="/discover">Find a pool</Link>
                  </Button>
                </div>
              ) : analytics && comparisons && timeseries && rank ? (
                <AnalyticsBody
                  analytics={analytics}
                  comparisons={comparisons}
                  timeseries={timeseries}
                  rank={rank}
                />
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0 outline-none">
          {activeTab === 'history' ? (
            <HistoricalPerformancePage embedded />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading analytics">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <ShimmerBlock className="h-56 w-full rounded-xl" />
      <ShimmerBlock className="h-56 w-full rounded-xl" />
      <ShimmerBlock className="h-40 w-full rounded-xl" />
    </div>
  )
}

function AnalyticsBody({
  analytics,
  comparisons,
  timeseries,
  rank,
}: {
  analytics: UserAnalytics
  comparisons: AnalyticsComparisons
  timeseries: AnalyticsTimeseries
  rank: AnalyticsBestRank
}) {
  const dailyAccuracy = timeseries.daily.map((d) => ({
    day: d.day,
    accuracy: rateToChartPercent(d.accuracy),
    predictions: d.predictions,
  }))
  const dailyPoints = timeseries.daily.map((d) => ({
    day: d.day,
    points: d.points,
  }))
  const formPoints = timeseries.recent_form
    .slice(-30)
    .map((p) => ({
      seq: p.seq,
      rolling_accuracy: rateToChartPercent(p.rolling_accuracy),
    }))

  const bestKey = analytics.best_sport
  const weakKey = analytics.weakest_sport
  const hasBestWeak = Boolean(bestKey || weakKey)

  return (
    <div className="space-y-6">
      <AiInsightsCard />

      <p className="text-xs text-muted-foreground">
        Based on{' '}
        <span className="font-medium tabular-nums text-foreground">
          {analytics.finalized_predictions.toLocaleString()}
        </span>{' '}
        finalized predictions
        {analytics.exact_count || analytics.correct_count
          ? ` · ${analytics.exact_count} exact · ${analytics.correct_count} correct`
          : null}
      </p>

      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Key performance indicators"
      >
        <KpiCard
          label="Overall accuracy"
          value={formatAccuracyPercent(analytics.accuracy)}
          hint="Exact + correct ÷ finalized"
        />
        <KpiCard
          label="Exact-score rate"
          value={formatAccuracyPercent(analytics.exact_rate)}
          hint="Exact scores ÷ finalized"
        />
        <KpiCard
          label="Total points"
          value={formatPoints(analytics.total_points)}
        />
        <KpiCard
          label="Best rank"
          value={formatBestRankLabel(rank)}
          hint={
            rank.best_rank_pool
              ? `${rank.best_rank_pool} · all-time`
              : 'all-time'
          }
        />
      </section>

      <ComparisonsBlock
        userAccuracy={analytics.accuracy}
        comparisons={comparisons}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartPanel
          title="Accuracy over time"
          description="Daily accuracy for the selected range"
        >
          {dailyAccuracy.length === 0 ? (
            <ChartEmpty />
          ) : (
            <ChartContainer
              config={accuracyChartConfig}
              className="aspect-[16/9] w-full min-h-[200px]"
            >
              <LineChart data={dailyAccuracy} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  width={40}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="var(--color-accuracy)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </ChartPanel>

        <ChartPanel
          title="Points over time"
          description="Points earned per day"
        >
          {dailyPoints.length === 0 ? (
            <ChartEmpty />
          ) : (
            <ChartContainer
              config={pointsChartConfig}
              className="aspect-[16/9] w-full min-h-[200px]"
            >
              <BarChart data={dailyPoints} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis width={36} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="points"
                  fill="var(--color-points)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </ChartPanel>
      </section>

      <ChartPanel
        title="Recent form"
        description="Rolling accuracy (last 10 finalized) within selected range"
      >
        {formPoints.length === 0 ? (
          <ChartEmpty />
        ) : (
          <ChartContainer
            config={formChartConfig}
            className="aspect-[21/9] w-full min-h-[200px]"
          >
            <LineChart data={formPoints} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="seq"
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                width={40}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="rolling_accuracy"
                stroke="var(--color-rolling_accuracy)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </ChartPanel>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-card/40 p-3 sm:p-4">
          <h2 className="font-display text-xl tracking-wide text-foreground">
            By sport
          </h2>
          {!hasBestWeak ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Predict more to unlock best/weakest sport (≥10 finalized per
              sport)
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Best / weakest require ≥10 finalized in that sport
            </p>
          )}
          <div className="mt-3 overflow-x-auto">
            {analytics.by_sport.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No sport breakdown yet
              </p>
            ) : (
              <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                <thead className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Sport</th>
                    <th className="px-2 py-2">Finalized</th>
                    <th className="px-2 py-2">Accuracy</th>
                    <th className="px-2 py-2">Exact</th>
                    <th className="px-2 py-2">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.by_sport.map((row) => {
                    const isBest = bestKey != null && row.sport === bestKey
                    const isWeak = weakKey != null && row.sport === weakKey
                    return (
                      <tr
                        key={row.sport}
                        className={cn(
                          'border-b border-border/50 last:border-0',
                          isBest && 'bg-emerald-500/10',
                          isWeak && 'bg-red-500/10',
                        )}
                      >
                        <td className="px-2 py-2.5 font-medium text-foreground">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {formatSportLabel(row.sport)}
                            {isBest ? (
                              <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                                <ArrowUp className="h-3 w-3" aria-hidden />
                                Best
                              </span>
                            ) : null}
                            {isWeak ? (
                              <span className="inline-flex items-center gap-0.5 rounded border border-red-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:text-red-200">
                                <ArrowDown className="h-3 w-3" aria-hidden />
                                Weakest
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {row.finalized}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {formatAccuracyPercent(row.accuracy)}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {formatAccuracyPercent(row.exact_rate)}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {formatPoints(row.points)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/40 p-3 sm:p-4">
          <h2 className="font-display text-xl tracking-wide text-foreground">
            By competition
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Selected range
          </p>
          <div className="mt-3 overflow-x-auto">
            {analytics.by_competition.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No competition breakdown yet
              </p>
            ) : (
              <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                <thead className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Competition</th>
                    <th className="px-2 py-2">Finalized</th>
                    <th className="px-2 py-2">Accuracy</th>
                    <th className="px-2 py-2">Exact</th>
                    <th className="px-2 py-2">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.by_competition.map((row) => (
                    <tr
                      key={row.event_id ?? row.event_name}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-2 py-2.5 font-medium text-foreground">
                        {row.event_name}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {row.finalized}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {formatAccuracyPercent(row.accuracy)}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {formatAccuracyPercent(row.exact_rate)}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {formatPoints(row.points)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl tabular-nums tracking-wide text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function ComparisonsBlock({
  userAccuracy,
  comparisons,
}: {
  userAccuracy: number | null
  comparisons: AnalyticsComparisons
}) {
  const you = formatAccuracyPercent(userAccuracy)
  const avg = formatAccuracyPercent(comparisons.poolcup_avg_accuracy)
  const friends = comparisons.friends_avg_accuracy

  return (
    <section
      className="rounded-xl border border-border/80 bg-card/40 p-3 sm:p-4"
      aria-label="Comparisons"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Trophy className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="font-display text-xl tracking-wide text-foreground">
          Comparisons
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          All-time
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-3">
          <p className="text-xs text-muted-foreground">You vs PoolCup avg</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            You: {you} vs PoolCup avg: {avg}
          </p>
          <ComparisonBars
            you={userAccuracy}
            other={comparisons.poolcup_avg_accuracy}
            otherLabel="PoolCup"
          />
        </div>
        <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-3">
          <p className="text-xs text-muted-foreground">You vs friends</p>
          {friends == null ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Add friends to compare
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm font-medium text-foreground">
                You: {you} vs Friends avg:{' '}
                {formatAccuracyPercent(friends)}
              </p>
              <ComparisonBars
                you={userAccuracy}
                other={friends}
                otherLabel="Friends"
              />
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function ComparisonBars({
  you,
  other,
  otherLabel,
}: {
  you: number | null
  other: number | null
  otherLabel: string
}) {
  if (you == null && other == null) return null
  const youPct = you == null ? 0 : Math.max(0, Math.min(100, you * 100))
  const otherPct =
    other == null ? 0 : Math.max(0, Math.min(100, other * 100))
  return (
    <div className="mt-3 space-y-2" aria-hidden>
      <div>
        <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
          <span>You</span>
          <span>{formatAccuracyPercent(you)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${youPct}%` }}
          />
        </div>
      </div>
      <div>
        <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
          <span>{otherLabel}</span>
          <span>{formatAccuracyPercent(other)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-muted-foreground/50"
            style={{ width: `${otherPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/40 p-3 sm:p-4">
      <h2 className="font-display text-xl tracking-wide text-foreground">
        {title}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function ChartEmpty() {
  return (
    <p className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
      No data in this range
    </p>
  )
}
