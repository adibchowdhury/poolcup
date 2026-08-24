'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  History,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { formatKickoffCompact } from '@/src/lib/match-kickoff-display'
import { capturePostHog } from '@/src/lib/posthog-client'
import {
  HISTORY_PAGE_SIZE,
  RESULT_FILTER_OPTIONS,
  formatHistorySportLabel,
  historyFiltersToSearchParams,
  historyHasActiveFilters,
  parseHistoryFilters,
  type HistoryFilterOptions,
  type HistoryFilters,
  type PredictionHistoryOutcome,
  type PredictionHistoryRow,
} from '@/src/lib/prediction-history'

type HistoryApiResponse = {
  rows: PredictionHistoryRow[]
  totalCount: number
  pageSize: number
  isPro: boolean
  filtersApplied: boolean
  filterOptions: HistoryFilterOptions | null
  error?: string
}

function emptyFilters(page = 1): HistoryFilters {
  return {
    sport: null,
    eventId: null,
    poolId: null,
    result: null,
    dateFrom: null,
    dateTo: null,
    q: null,
    page,
  }
}

function outcomeBadgeClass(outcome: string): string {
  switch (outcome) {
    case 'exact':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
    case 'correct':
      return 'border-sky-500/40 bg-sky-500/15 text-sky-800 dark:text-sky-200'
    case 'incorrect':
      return 'border-red-500/40 bg-red-500/15 text-red-800 dark:text-red-200'
    default:
      return 'border-border bg-muted/60 text-muted-foreground'
  }
}

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'exact':
      return 'Exact'
    case 'correct':
      return 'Correct'
    case 'incorrect':
      return 'Incorrect'
    default:
      return 'Pending'
  }
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const label = outcomeLabel(outcome)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        outcomeBadgeClass(outcome),
      )}
    >
      {label}
    </span>
  )
}

function selectClassName(disabled?: boolean) {
  return cn(
    'h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground shadow-xs outline-none',
    'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
    disabled && 'cursor-not-allowed opacity-50',
  )
}

export function PredictionHistoryPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = parseHistoryFilters(searchParams)
  const [rows, setRows] = useState<PredictionHistoryRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [filterOptions, setFilterOptions] =
    useState<HistoryFilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draftQ, setDraftQ] = useState(filters.q ?? '')
  const viewedOnce = useRef(false)
  const lastFilterKey = useRef<string | null>(null)

  const replaceFilters = useCallback(
    (next: HistoryFilters) => {
      const qs = historyFiltersToSearchParams(next).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = searchParams.toString()
      const res = await fetch(`/api/history${qs ? `?${qs}` : ''}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (res.status === 401) {
        router.replace('/login?next=/history')
        return
      }
      const json = (await res.json()) as HistoryApiResponse
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load prediction history')
      }
      setRows(json.rows ?? [])
      setTotalCount(json.totalCount ?? 0)
      setFilterOptions(json.filterOptions ?? null)

      if (!viewedOnce.current) {
        viewedOnce.current = true
        capturePostHog('prediction_history_viewed', {
          is_pro: true,
          total_count: json.totalCount ?? 0,
        })
      }

      if (historyHasActiveFilters(parseHistoryFilters(searchParams))) {
        const key = searchParams.toString()
        if (key && key !== lastFilterKey.current) {
          lastFilterKey.current = key
          const parsed = parseHistoryFilters(searchParams)
          const which = [
            parsed.sport ? 'sport' : null,
            parsed.eventId ? 'event' : null,
            parsed.poolId ? 'pool' : null,
            parsed.result ? 'result' : null,
            parsed.dateFrom || parsed.dateTo ? 'date' : null,
            parsed.q ? 'search' : null,
          ].filter(Boolean)
          capturePostHog('prediction_history_filtered', {
            filters: which,
            sport: parsed.sport,
            result: parsed.result,
            has_search: Boolean(parsed.q),
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setRows([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [router, searchParams])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setDraftQ(filters.q ?? '')
  }, [filters.q])

  const totalPages = Math.max(1, Math.ceil(totalCount / HISTORY_PAGE_SIZE))
  const page = Math.min(filters.page, totalPages)
  const hasFilters = historyHasActiveFilters(filters)
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * HISTORY_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * HISTORY_PAGE_SIZE, totalCount)

  function patchFilters(patch: Partial<HistoryFilters>, resetPage = true) {
    const pageOnly =
      Object.keys(patch).length === 1 && Object.prototype.hasOwnProperty.call(patch, 'page')
    replaceFilters({
      ...filters,
      ...patch,
      page: resetPage && !pageOnly ? 1 : (patch.page ?? filters.page),
    })
  }

  function clearFilters() {
    setDraftQ('')
    replaceFilters(emptyFilters(1))
  }

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault()
    const next = draftQ.trim() || null
    patchFilters({ q: next })
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Predictions
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl tracking-wide text-foreground sm:text-4xl">
            <History className="h-7 w-7 shrink-0 text-muted-foreground" aria-hidden />
            History
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Your full prediction record across pools — browse, filter, and search.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className={FOCUS_VISIBLE_RING}>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <section
        className="mb-5 rounded-xl border border-border/80 bg-card/40 p-3 sm:p-4"
        aria-label="History filters"
      >

        <fieldset
          disabled={loading}
          className={cn(
            'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
            
          )}
        >
          <legend className="sr-only">Filter prediction history</legend>

          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
            Sport
            <select
              className={selectClassName(false)}
              value={filters.sport ?? ''}
              onChange={(e) =>
                patchFilters({ sport: e.target.value || null })
              }
              aria-label="Filter by sport"
            >
              <option value="">All sports</option>
              {(filterOptions?.sports ?? []).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
            Competition
            <select
              className={selectClassName(false)}
              value={filters.eventId ?? ''}
              onChange={(e) =>
                patchFilters({ eventId: e.target.value || null })
              }
              aria-label="Filter by competition"
            >
              <option value="">All competitions</option>
              {(filterOptions?.events ?? []).map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
            Pool
            <select
              className={selectClassName(false)}
              value={filters.poolId ?? ''}
              onChange={(e) =>
                patchFilters({ poolId: e.target.value || null })
              }
              aria-label="Filter by pool"
            >
              <option value="">All pools</option>
              {(filterOptions?.pools ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
            Result
            <select
              className={selectClassName(false)}
              value={filters.result ?? ''}
              onChange={(e) => {
                const v = e.target.value
                patchFilters({
                  result:
                    v === 'exact' ||
                    v === 'correct' ||
                    v === 'incorrect' ||
                    v === 'pending'
                      ? (v as PredictionHistoryOutcome)
                      : null,
                })
              }}
              aria-label="Filter by result"
            >
              {RESULT_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
            From
            <Input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) =>
                patchFilters({ dateFrom: e.target.value || null })
              }
              disabled={false}
              aria-label="Filter from date"
            />
          </label>

          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
            To
            <Input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) =>
                patchFilters({ dateTo: e.target.value || null })
              }
              disabled={false}
              aria-label="Filter to date"
            />
          </label>

          <form
            onSubmit={onSearchSubmit}
            className="space-y-1.5 sm:col-span-2 lg:col-span-3"
          >
            <label
              htmlFor="history-search"
              className="block text-xs font-medium text-muted-foreground"
            >
              Search teams or events
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="history-search"
                  value={draftQ}
                  onChange={(e) => setDraftQ(e.target.value)}
                  placeholder="Team or event name"
                  disabled={false}
                  className="pl-8"
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                disabled={false}
                className={FOCUS_VISIBLE_RING}
              >
                Search
              </Button>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearFilters}
                  className={cn('gap-1.5', FOCUS_VISIBLE_RING)}
                >
                  <X className="h-4 w-4" aria-hidden />
                  Clear
                </Button>
              ) : null}
            </div>
          </form>
        </fieldset>
      </section>

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
        <HistoryListSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? 'No predictions match your filters'
              : 'No predictions yet'}
          </p>
          {hasFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('mt-3', FOCUS_VISIBLE_RING)}
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className={cn('mt-3', FOCUS_VISIBLE_RING)}
            >
              <Link href="/discover">Find a pool</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Showing{' '}
              <span className="font-medium tabular-nums text-foreground">
                {rangeStart}–{rangeEnd}
              </span>{' '}
              of{' '}
              <span className="font-medium tabular-nums text-foreground">
                {totalCount}
              </span>
            </p>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden" aria-label="Prediction history">
            {rows.map((row) => (
              <HistoryCard key={row.prediction_id} row={row} />
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border/80 md:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Match
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Event
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Kickoff
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Predicted
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Actual
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Points
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Outcome
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.prediction_id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-foreground">
                        {row.team1_name ?? 'Team 1'} v{' '}
                        {row.team2_name ?? 'Team 2'}
                      </p>
                      {row.pool_name ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.pool_name}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top text-muted-foreground">
                      <p className="text-foreground">
                        {row.event_name ?? '—'}
                      </p>
                      <p className="mt-0.5 text-xs">
                        {formatHistorySportLabel(row.sport)}
                        {row.round ? ` · ${row.round}` : null}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">
                      {row.kickoff_at
                        ? formatKickoffCompact(row.kickoff_at)
                        : '—'}
                    </td>
                    <td className="px-3 py-3 align-top font-mono tabular-nums text-foreground">
                      {row.predicted ?? '—'}
                    </td>
                    <td className="px-3 py-3 align-top font-mono tabular-nums text-foreground">
                      {row.actual_result ?? 'pending'}
                    </td>
                    <td className="px-3 py-3 align-top font-mono tabular-nums text-foreground">
                      {row.points_awarded}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <OutcomeBadge outcome={row.outcome} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <nav
              className="mt-4 flex items-center justify-between gap-3"
              aria-label="Pagination"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                className={cn('gap-1', FOCUS_VISIBLE_RING)}
                onClick={() =>
                  patchFilters({ page: Math.max(1, page - 1) }, false)
                }
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Previous
              </Button>
              <p className="text-xs tabular-nums text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                className={cn('gap-1', FOCUS_VISIBLE_RING)}
                onClick={() =>
                  patchFilters({ page: Math.min(totalPages, page + 1) }, false)
                }
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}

function HistoryCard({ row }: { row: PredictionHistoryRow }) {
  return (
    <li className="rounded-xl border border-border/80 bg-card/70 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.team1_name ?? 'Team 1'} v {row.team2_name ?? 'Team 2'}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.event_name ?? 'Competition'}
            {row.sport ? ` · ${formatHistorySportLabel(row.sport)}` : null}
          </p>
        </div>
        <OutcomeBadge outcome={row.outcome} />
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Kickoff</dt>
          <dd className="tabular-nums text-foreground">
            {row.kickoff_at ? formatKickoffCompact(row.kickoff_at) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Predicted</dt>
          <dd className="font-mono tabular-nums text-foreground">
            {row.predicted ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Actual</dt>
          <dd className="font-mono tabular-nums text-foreground">
            {row.actual_result ?? 'pending'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Points</dt>
          <dd className="font-mono tabular-nums text-foreground">
            {row.points_awarded}
          </dd>
        </div>
      </dl>
      {row.pool_name ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{row.pool_name}</p>
      ) : null}
    </li>
  )
}

function HistoryListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading history">
      {Array.from({ length: 6 }).map((_, i) => (
        <ShimmerBlock key={i} className="h-[4.5rem] w-full rounded-xl md:h-14" />
      ))}
    </div>
  )
}
