'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { LockedProFeature } from '@/components/pro/locked-pro-feature'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import {
  formatAccuracyPercent,
  formatDeltaAccuracy,
  formatDeltaInt,
  formatHistoricalRank,
  formatPoints,
  formatSportLabel,
  type HistoricalAllTime,
  type HistoricalSeasonRow,
  type HistoricalYearRow,
} from '@/src/lib/historical-performance'

type ApiOk = {
  isPro: true
  allTime: HistoricalAllTime
  bySeason: HistoricalSeasonRow[]
  byYear: HistoricalYearRow[]
}

type ApiLocked = {
  isPro: false
  locked: true
  error?: string
}

type ViewMode = 'season' | 'year'

function selectClassName() {
  return cn(
    'h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground shadow-xs outline-none',
    'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
  )
}

type HistoricalPerformancePageProps = {
  /**
   * When true, omit page chrome (title / back link / outer padding) for use
   * inside the unified Analytics page History tab.
   */
  embedded?: boolean
}

export function HistoricalPerformancePage({
  embedded = false,
}: HistoricalPerformancePageProps) {
  const router = useRouter()
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allTime, setAllTime] = useState<HistoricalAllTime | null>(null)
  const [bySeason, setBySeason] = useState<HistoricalSeasonRow[]>([])
  const [byYear, setByYear] = useState<HistoricalYearRow[]>([])
  const [view, setView] = useState<ViewMode>('season')
  const [focusSeasonId, setFocusSeasonId] = useState<string>('')
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const viewedOnce = useRef(false)
  const comparedKey = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/history-performance', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (res.status === 401) {
        router.replace('/login?next=/analytics%3Ftab%3Dhistory')
        return
      }
      const json = (await res.json()) as ApiOk | ApiLocked

      if (res.status === 403 || (json as ApiLocked).locked) {
        setLocked(true)
        setAllTime(null)
        setBySeason([])
        setByYear([])
        if (!viewedOnce.current) {
          viewedOnce.current = true
          capturePostHog('historical_performance_viewed', { is_pro: false })
        }
        return
      }

      if (!res.ok) {
        throw new Error(
          (json as { error?: string }).error ||
            'Failed to load historical performance',
        )
      }

      const ok = json as ApiOk
      setLocked(false)
      setAllTime(ok.allTime)
      setBySeason(ok.bySeason)
      setByYear(ok.byYear)

      const first = ok.bySeason[0]?.event_id ?? ''
      const second = ok.bySeason[1]?.event_id ?? ''
      setFocusSeasonId((prev) =>
        prev && ok.bySeason.some((s) => s.event_id === prev) ? prev : first,
      )
      setCompareA((prev) =>
        prev && ok.bySeason.some((s) => s.event_id === prev) ? prev : first,
      )
      setCompareB((prev) =>
        prev && ok.bySeason.some((s) => s.event_id === prev) ? prev : second,
      )

      if (!viewedOnce.current) {
        viewedOnce.current = true
        capturePostHog('historical_performance_viewed', {
          is_pro: true,
          seasons: ok.bySeason.length,
          years: ok.byYear.length,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setAllTime(null)
      setBySeason([])
      setByYear([])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const focusedSeason = useMemo(
    () => bySeason.find((s) => s.event_id === focusSeasonId) ?? null,
    [bySeason, focusSeasonId],
  )
  const seasonA = useMemo(
    () => bySeason.find((s) => s.event_id === compareA) ?? null,
    [bySeason, compareA],
  )
  const seasonB = useMemo(
    () => bySeason.find((s) => s.event_id === compareB) ?? null,
    [bySeason, compareB],
  )

  useEffect(() => {
    if (!seasonA || !seasonB || seasonA.event_id === seasonB.event_id) return
    const key = `${seasonA.event_id}|${seasonB.event_id}`
    if (comparedKey.current === key) return
    comparedKey.current = key
    capturePostHog('historical_season_compared', {
      season_a: seasonA.season,
      season_b: seasonB.season,
      event_a: seasonA.event_id,
      event_b: seasonB.event_id,
    })
  }, [seasonA, seasonB])

  const empty =
    !loading &&
    !locked &&
    !error &&
    allTime != null &&
    allTime.finalized === 0 &&
    bySeason.length === 0

  const body = (
    <>
      {locked && !loading ? (
        <LockedProFeature
          title="Historical Performance is a Pro feature"
          description="Unlock all-time summaries, season and year tables, and season-over-season comparisons."
          source="locked_historical_performance"
        />
      ) : error ? (
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
        <LoadingSkeleton />
      ) : empty ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No completed seasons yet
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
      ) : allTime ? (
        <div className="space-y-6">
          <AllTimeSummary allTime={allTime} />

          {bySeason.length > 0 ? (
            <section className="rounded-xl border border-border/80 bg-card/40 p-3 sm:p-4">
              <h2 className="font-display text-xl tracking-wide text-foreground">
                Season detail
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Focus a competition/event season
              </p>
              <label className="mt-3 block space-y-1.5 text-xs font-medium text-muted-foreground">
                Season
                <select
                  className={selectClassName()}
                  value={focusSeasonId}
                  onChange={(e) => setFocusSeasonId(e.target.value)}
                  aria-label="Focus season"
                >
                  {bySeason.map((s) => (
                    <option key={s.event_id} value={s.event_id}>
                      {s.season}
                      {s.sport ? ` · ${formatSportLabel(s.sport)}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {focusedSeason ? (
                <SeasonDetailCard season={focusedSeason} />
              ) : null}
            </section>
          ) : null}

          <SeasonComparison
            seasons={bySeason}
            compareA={compareA}
            compareB={compareB}
            onCompareA={setCompareA}
            onCompareB={setCompareB}
            seasonA={seasonA}
            seasonB={seasonB}
          />

          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="History view"
          >
            <Button
              type="button"
              size="sm"
              variant={view === 'season' ? 'default' : 'outline'}
              aria-pressed={view === 'season'}
              className={cn('h-8', FOCUS_VISIBLE_RING)}
              onClick={() => setView('season')}
            >
              By season
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'year' ? 'default' : 'outline'}
              aria-pressed={view === 'year'}
              className={cn('h-8', FOCUS_VISIBLE_RING)}
              onClick={() => setView('year')}
            >
              By year
            </Button>
          </div>

          {view === 'season' ? (
            <BySeasonTable
              rows={bySeason}
              focusedId={focusSeasonId}
              onSelect={(id) => setFocusSeasonId(id)}
            />
          ) : (
            <ByYearTable rows={byYear} />
          )}
        </div>
      ) : null}
    </>
  )

  if (embedded) {
    return <div className="min-w-0">{body}</div>
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pro
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl tracking-wide text-foreground sm:text-4xl">
            <CalendarRange
              className="h-7 w-7 shrink-0 text-muted-foreground"
              aria-hidden
            />
            Historical performance
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Season and calendar-year results from your finalized predictions.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className={FOCUS_VISIBLE_RING}>
          <Link href="/analytics?tab=history">Back to analytics</Link>
        </Button>
      </div>
      {body}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div
      className="space-y-5"
      aria-busy="true"
      aria-label="Loading historical performance"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <ShimmerBlock className="h-40 w-full rounded-xl" />
      <ShimmerBlock className="h-56 w-full rounded-xl" />
    </div>
  )
}

function AllTimeSummary({ allTime }: { allTime: HistoricalAllTime }) {
  return (
    <section aria-label="All-time summary">
      <h2 className="mb-3 font-display text-xl tracking-wide text-foreground">
        All-time summary
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Finalized" value={allTime.finalized.toLocaleString()} />
        <StatCard
          label="Accuracy"
          value={formatAccuracyPercent(allTime.accuracy)}
        />
        <StatCard
          label="Exact scores"
          value={allTime.exact_count.toLocaleString()}
        />
        <StatCard label="Points" value={formatPoints(allTime.points)} />
        <StatCard
          label="Seasons played"
          value={allTime.seasons_played.toLocaleString()}
        />
      </div>
    </section>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl tabular-nums tracking-wide text-foreground">
        {value}
      </p>
    </div>
  )
}

function SeasonDetailCard({ season }: { season: HistoricalSeasonRow }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <DetailStat label="Sport" value={formatSportLabel(season.sport)} />
      <DetailStat
        label="Accuracy"
        value={formatAccuracyPercent(season.accuracy)}
      />
      <DetailStat label="Points" value={formatPoints(season.points)} />
      <DetailStat
        label="Exact"
        value={season.exact_count.toLocaleString()}
      />
      <DetailStat
        label="Finalized"
        value={season.finalized.toLocaleString()}
      />
      <DetailStat
        label="Best rank"
        value={formatHistoricalRank(season.best_rank, season.pool_size)}
      />
    </dl>
  )
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  )
}

function SeasonComparison({
  seasons,
  compareA,
  compareB,
  onCompareA,
  onCompareB,
  seasonA,
  seasonB,
}: {
  seasons: HistoricalSeasonRow[]
  compareA: string
  compareB: string
  onCompareA: (id: string) => void
  onCompareB: (id: string) => void
  seasonA: HistoricalSeasonRow | null
  seasonB: HistoricalSeasonRow | null
}) {
  const canCompare = seasons.length >= 2

  return (
    <section className="rounded-xl border border-border/80 bg-card/40 p-3 sm:p-4">
      <h2 className="font-display text-xl tracking-wide text-foreground">
        Season-over-season
      </h2>
      {!canCompare ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Compare needs at least two seasons. Keep predicting to unlock this.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
              Season A
              <select
                className={selectClassName()}
                value={compareA}
                onChange={(e) => onCompareA(e.target.value)}
                aria-label="Compare season A"
              >
                {seasons.map((s) => (
                  <option key={s.event_id} value={s.event_id}>
                    {s.season}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
              Season B
              <select
                className={selectClassName()}
                value={compareB}
                onChange={(e) => onCompareB(e.target.value)}
                aria-label="Compare season B"
              >
                {seasons.map((s) => (
                  <option key={s.event_id} value={s.event_id}>
                    {s.season}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {seasonA && seasonB && seasonA.event_id === seasonB.event_id ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Pick two different seasons to compare.
            </p>
          ) : seasonA && seasonB ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Metric</th>
                    <th className="px-2 py-2">{seasonA.season}</th>
                    <th className="px-2 py-2">{seasonB.season}</th>
                    <th className="px-2 py-2">Delta (A − B)</th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Accuracy"
                    a={formatAccuracyPercent(seasonA.accuracy)}
                    b={formatAccuracyPercent(seasonB.accuracy)}
                    delta={formatDeltaAccuracy(
                      seasonA.accuracy,
                      seasonB.accuracy,
                    )}
                  />
                  <CompareRow
                    label="Points"
                    a={formatPoints(seasonA.points)}
                    b={formatPoints(seasonB.points)}
                    delta={formatDeltaInt(seasonA.points, seasonB.points)}
                  />
                  <CompareRow
                    label="Exact"
                    a={seasonA.exact_count.toLocaleString()}
                    b={seasonB.exact_count.toLocaleString()}
                    delta={formatDeltaInt(
                      seasonA.exact_count,
                      seasonB.exact_count,
                    )}
                  />
                  <CompareRow
                    label="Best rank"
                    a={formatHistoricalRank(
                      seasonA.best_rank,
                      seasonA.pool_size,
                    )}
                    b={formatHistoricalRank(
                      seasonB.best_rank,
                      seasonB.pool_size,
                    )}
                    delta={
                      seasonA.best_rank != null && seasonB.best_rank != null
                        ? formatDeltaInt(seasonB.best_rank, seasonA.best_rank)
                        : '—'
                    }
                  />
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Rank delta uses B − A so a positive number means A ranked better
                (lower place).
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function CompareRow({
  label,
  a,
  b,
  delta,
}: {
  label: string
  a: string
  b: string
  delta: string
}) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="px-2 py-2.5 font-medium text-foreground">{label}</td>
      <td className="px-2 py-2.5 tabular-nums">{a}</td>
      <td className="px-2 py-2.5 tabular-nums">{b}</td>
      <td className="px-2 py-2.5 tabular-nums text-muted-foreground">{delta}</td>
    </tr>
  )
}

function BySeasonTable({
  rows,
  focusedId,
  onSelect,
}: {
  rows: HistoricalSeasonRow[]
  focusedId: string
  onSelect: (id: string) => void
}) {
  return (
    <section className="rounded-xl border border-border/80 bg-card/40 p-3 sm:p-4">
      <h2 className="font-display text-xl tracking-wide text-foreground">
        By season
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Competition/event seasons · newest first
      </p>
      <div className="mt-3 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No seasons yet
          </p>
        ) : (
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Season</th>
                <th className="px-2 py-2">Sport</th>
                <th className="px-2 py-2">Accuracy</th>
                <th className="px-2 py-2">Points</th>
                <th className="px-2 py-2">Exact</th>
                <th className="px-2 py-2">Best rank</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const selected = row.event_id === focusedId
                return (
                  <tr
                    key={row.event_id}
                    className={cn(
                      'border-b border-border/50 last:border-0',
                      selected && 'bg-primary/5',
                    )}
                  >
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        className={cn(
                          'text-left font-medium text-foreground underline-offset-4 hover:underline',
                          FOCUS_VISIBLE_RING,
                          'rounded-sm',
                        )}
                        onClick={() => onSelect(row.event_id)}
                      >
                        {row.season}
                      </button>
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground">
                      {formatSportLabel(row.sport)}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">
                      {formatAccuracyPercent(row.accuracy)}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">
                      {formatPoints(row.points)}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">
                      {row.exact_count}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">
                      {formatHistoricalRank(row.best_rank, row.pool_size)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

function ByYearTable({ rows }: { rows: HistoricalYearRow[] }) {
  return (
    <section className="rounded-xl border border-border/80 bg-card/40 p-3 sm:p-4">
      <h2 className="font-display text-xl tracking-wide text-foreground">
        By year
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Calendar year by match kickoff · newest first
      </p>
      <div className="mt-3 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No yearly history yet
          </p>
        ) : (
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <thead className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Year</th>
                <th className="px-2 py-2">Accuracy</th>
                <th className="px-2 py-2">Points</th>
                <th className="px-2 py-2">Exact</th>
                <th className="px-2 py-2">Finalized</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.year}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-2 py-2.5 font-medium tabular-nums text-foreground">
                    {row.year}
                  </td>
                  <td className="px-2 py-2.5 tabular-nums">
                    {formatAccuracyPercent(row.accuracy)}
                  </td>
                  <td className="px-2 py-2.5 tabular-nums">
                    {formatPoints(row.points)}
                  </td>
                  <td className="px-2 py-2.5 tabular-nums">
                    {row.exact_count}
                  </td>
                  <td className="px-2 py-2.5 tabular-nums">
                    {row.finalized}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
