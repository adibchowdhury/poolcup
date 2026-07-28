'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatPointsDelta,
  formatRelativeTimestamp,
  getPointsTransactionDescription,
  POINTS_FEED_ANIMATION_MS,
  POINTS_FEED_STAGGER_MS,
  type PointsTransactionRow,
} from '@/src/lib/points-transaction-feed'
import { supabase } from '@/src/lib/supabase'

type PointsHistoryFeedProps = {
  userId: string
  animKey: number
  active: boolean
  className?: string
  /** On viewports below lg, show a collapsed-by-default toggle header. Desktop is unchanged. */
  mobileCollapsible?: boolean
  /** Collapsed-by-default toggle on all breakpoints (matches app profile). */
  alwaysCollapsible?: boolean
}

export function PointsHistoryFeed({
  userId,
  animKey,
  active,
  className,
  mobileCollapsible = false,
  alwaysCollapsible = false,
}: PointsHistoryFeedProps) {
  const [transactions, setTransactions] = useState<PointsTransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('points_transactions')
      .select('id, reason, points, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load points transactions:', error.message)
      setTransactions([])
    } else {
      setTransactions((data ?? []) as PointsTransactionRow[])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!active) return
    void loadTransactions()
  }, [active, loadTransactions, animKey])

  const countLabel =
    !loading || transactions.length > 0 ? ` (${transactions.length})` : ''

  const feedBody =
    loading && transactions.length === 0 ? (
      <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
    ) : transactions.length === 0 ? (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Your glory story starts here 🏆
      </p>
    ) : (
      <div className="profile-points-feed-scroll max-h-[500px] overflow-y-auto">
        <ul className="divide-y divide-border/50">
          {transactions.map((tx, index) => {
            const description = getPointsTransactionDescription(tx.reason)
            return (
              <li
                key={`${tx.id}-${animKey}`}
                className={cn(
                  'flex items-start gap-3 py-4 animate-in fade-in slide-in-from-bottom-4 fill-mode-both',
                )}
                style={{
                  animationDuration: `${POINTS_FEED_ANIMATION_MS}ms`,
                  animationDelay: `${index * POINTS_FEED_STAGGER_MS}ms`,
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTimestamp(tx.created_at)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-primary">
                  {formatPointsDelta(tx.points)}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    )

  return (
    <div
      className={cn(
        'w-full min-w-0',
        !alwaysCollapsible && 'lg:flex-1 lg:max-w-md xl:max-w-lg',
        className,
      )}
    >
      {alwaysCollapsible ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 text-left transition-colors hover:bg-muted/30"
          aria-expanded={expanded}
          aria-label="Toggle points history"
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="font-display text-2xl tracking-wide text-foreground">
            Points history{countLabel}
          </span>
          <ChevronDown
            className={cn(
              'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      ) : (
        <>
          <h2
            className={cn(
              'font-display text-2xl tracking-wide text-foreground',
              mobileCollapsible ? 'hidden lg:block' : 'block',
            )}
          >
            POINT HISTORY
          </h2>

          {mobileCollapsible ? (
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card/80 px-4 py-3 text-left transition-colors hover:bg-muted/40 lg:hidden"
              aria-expanded={expanded}
              aria-label="Toggle points history"
              onClick={() => setExpanded((open) => !open)}
            >
              <span className="font-display text-lg tracking-wide text-foreground">
                Points history{countLabel}
              </span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
                  expanded && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
          ) : null}
        </>
      )}

      <div
        className={cn(
          alwaysCollapsible ? 'mt-2' : 'mt-6',
          alwaysCollapsible
            ? expanded
              ? 'block'
              : 'hidden'
            : mobileCollapsible && !expanded
              ? 'hidden lg:block'
              : 'block',
        )}
      >
        {feedBody}
      </div>
    </div>
  )
}
