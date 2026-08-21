'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'
import type { ClassicPredictionSortMode } from '@/src/lib/sort-classic-predictions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type PredictionStatusFilter =
  | 'all'
  | 'unpicked'
  | 'predicted'
  | 'completed'

export type PredictionStatusFilterCounts = {
  all: number
  unpicked: number
  predicted: number
  completed: number
}

export type PredictionSortOption = {
  value: ClassicPredictionSortMode
  label: string
}

type PoolPredictionStatusFilterContextValue = {
  statusFilter: PredictionStatusFilter
  setStatusFilter: (next: PredictionStatusFilter) => void
  counts: PredictionStatusFilterCounts
  setCounts: (next: PredictionStatusFilterCounts) => void
  showFilters: boolean
  setShowFilters: (next: boolean) => void
  sortMode: ClassicPredictionSortMode
  setSortMode: (next: ClassicPredictionSortMode) => void
  sortOptions: PredictionSortOption[]
  setSortOptions: (next: PredictionSortOption[]) => void
}

const PoolPredictionStatusFilterContext =
  createContext<PoolPredictionStatusFilterContextValue | null>(null)

const EMPTY_COUNTS: PredictionStatusFilterCounts = {
  all: 0,
  unpicked: 0,
  predicted: 0,
  completed: 0,
}

export function PoolPredictionStatusFilterProvider({
  children,
}: {
  children: ReactNode
}) {
  const [statusFilter, setStatusFilter] =
    useState<PredictionStatusFilter>('all')
  const [counts, setCounts] =
    useState<PredictionStatusFilterCounts>(EMPTY_COUNTS)
  const [showFilters, setShowFilters] = useState(false)
  const [sortMode, setSortMode] =
    useState<ClassicPredictionSortMode>('kickoff-oldest')
  const [sortOptions, setSortOptions] = useState<PredictionSortOption[]>([])

  const setCountsSafe = useCallback((next: PredictionStatusFilterCounts) => {
    setCounts((prev) =>
      prev.all === next.all &&
      prev.unpicked === next.unpicked &&
      prev.predicted === next.predicted &&
      prev.completed === next.completed
        ? prev
        : next,
    )
  }, [])

  const setSortOptionsSafe = useCallback((next: PredictionSortOption[]) => {
    setSortOptions((prev) => {
      if (
        prev.length === next.length &&
        prev.every(
          (option, index) =>
            option.value === next[index]?.value &&
            option.label === next[index]?.label,
        )
      ) {
        return prev
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      statusFilter,
      setStatusFilter,
      counts,
      setCounts: setCountsSafe,
      showFilters,
      setShowFilters,
      sortMode,
      setSortMode,
      sortOptions,
      setSortOptions: setSortOptionsSafe,
    }),
    [
      statusFilter,
      counts,
      showFilters,
      setCountsSafe,
      sortMode,
      sortOptions,
      setSortOptionsSafe,
    ],
  )

  return (
    <PoolPredictionStatusFilterContext.Provider value={value}>
      {children}
    </PoolPredictionStatusFilterContext.Provider>
  )
}

export function usePoolPredictionStatusFilter() {
  const ctx = useContext(PoolPredictionStatusFilterContext)
  if (!ctx) {
    throw new Error(
      'usePoolPredictionStatusFilter must be used within PoolPredictionStatusFilterProvider',
    )
  }
  return ctx
}

export function usePoolPredictionStatusFilterOptional() {
  return useContext(PoolPredictionStatusFilterContext)
}

export function PredictionStatusFilterTabs({
  className,
}: {
  className?: string
}) {
  const { statusFilter, setStatusFilter, counts, showFilters } =
    usePoolPredictionStatusFilter()

  if (!showFilters) return null

  const filterTabs: {
    id: PredictionStatusFilter
    label: string
    count: number
  }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'unpicked', label: 'Unpicked', count: counts.unpicked },
    { id: 'predicted', label: 'Predicted', count: counts.predicted },
    ...(counts.completed > 0
      ? [
          {
            id: 'completed' as const,
            label: 'Completed',
            count: counts.completed,
          },
        ]
      : []),
  ]

  return (
    <div className={cn('space-y-2 border-t border-border/70 pt-2.5', className)}>
      <p className="truncate px-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Your Predictions
      </p>
      <div
        className="flex flex-col gap-0.5"
        role="tablist"
        aria-label="Filter predictions by status"
      >
        {filterTabs.map((tab) => {
          const selected = statusFilter === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'inline-flex min-h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-left text-[0.7rem] font-medium transition-[transform,background-color,border-color,color] duration-150',
                FOCUS_VISIBLE_RING,
                'active:translate-y-px',
                selected
                  ? 'border-primary/45 bg-primary/15 text-foreground'
                  : 'border-transparent bg-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <span className="min-w-0 truncate">{tab.label}</span>
              <span className="shrink-0 font-mono tabular-nums opacity-80">
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Desktop left-rail sort control (lg+ only mount site). */
export function PredictionSortControl({
  className,
}: {
  className?: string
}) {
  const { showFilters, sortMode, setSortMode, sortOptions } =
    usePoolPredictionStatusFilter()

  if (!showFilters || sortOptions.length === 0) return null

  return (
    <div className={cn('space-y-1.5 border-t border-border/70 pt-2.5', className)}>
      <label
        htmlFor="classic-predictions-sort-rail"
        className="block truncate px-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        Sort by
      </label>
      <Select
        value={sortMode}
        onValueChange={(value) =>
          setSortMode(value as ClassicPredictionSortMode)
        }
      >
        <SelectTrigger
          id="classic-predictions-sort-rail"
          size="sm"
          className="h-8 w-full min-w-0 border-border bg-card text-left text-[0.7rem] text-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
