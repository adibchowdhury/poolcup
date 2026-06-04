'use client'

import { useCallback, useEffect, useState } from 'react'
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
}

export function PointsHistoryFeed({
  userId,
  animKey,
  active,
}: PointsHistoryFeedProps) {
  const [transactions, setTransactions] = useState<PointsTransactionRow[]>([])
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="w-full min-w-0 lg:flex-1 lg:max-w-md xl:max-w-lg">
      <h2 className="font-display text-2xl tracking-wide text-foreground">
        POINT HISTORY
      </h2>

      <div className="mt-6">
        {loading && transactions.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : transactions.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Your glory story starts here 🏆
          </p>
        ) : (
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
        )}
      </div>
    </div>
  )
}
