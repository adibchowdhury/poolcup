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

type PoolPredictionStatusFilterContextValue = {
  statusFilter: PredictionStatusFilter
  setStatusFilter: (next: PredictionStatusFilter) => void
  counts: PredictionStatusFilterCounts
  setCounts: (next: PredictionStatusFilterCounts) => void
  showFilters: boolean
  setShowFilters: (next: boolean) => void
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

  const value = useMemo(
    () => ({
      statusFilter,
      setStatusFilter,
      counts,
      setCounts: setCountsSafe,
      showFilters,
      setShowFilters,
    }),
    [statusFilter, counts, showFilters, setCountsSafe],
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
