'use client'

import { PoolCard, type DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { JoinOrCreatePoolCard } from '@/components/dashboard/join-or-create-pool-card'
import { ActivePoolsSkeleton } from '@/components/dashboard/pool-card-skeleton'
import { fetchDashboardPools } from '@/src/lib/fetch-dashboard-pools'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useState } from 'react'

/** ~1.15 cards visible on mobile; fixed widths on larger breakpoints for multi-card peek. */
const POOL_CAROUSEL_ITEM_CLASS =
  'w-[calc((100vw-2rem)/1.12)] max-w-[300px] shrink-0 snap-start sm:w-[280px] md:w-[300px] lg:w-[320px]'

const POOL_CAROUSEL_SCROLL_CLASS = cn(
  '-mx-4 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory',
  '[scroll-padding-inline:1rem] [-webkit-overflow-scrolling:touch]',
  '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.35)_transparent]',
  '[&::-webkit-scrollbar]:h-1',
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25',
  '[&::-webkit-scrollbar-track]:bg-transparent',
)

const POOL_CAROUSEL_TRACK_CLASS = 'flex w-max min-w-full gap-4 px-4 pb-1'

interface ActivePoolsTabProps {
  userId: string
  pools?: DashboardPoolCardData[]
  loading?: boolean
  error?: string | null
  onPoolDeleted?: (poolId: string) => void
}

export function ActivePoolsTab({
  userId,
  pools: externalPools,
  loading: externalLoading,
  error: externalError,
  onPoolDeleted: externalOnPoolDeleted,
}: ActivePoolsTabProps) {
  const isControlled = externalPools !== undefined
  const [pools, setPools] = useState<DashboardPoolCardData[]>([])
  const [loading, setLoading] = useState(!isControlled)
  const [error, setError] = useState<string | null>(null)

  const loadPools = useCallback(async () => {
    if (isControlled) return

    setLoading(true)
    setError(null)

    const { pools: rows, error: fetchError } = await fetchDashboardPools(
      supabase,
      userId,
    )

    setPools(rows)
    setError(fetchError)
    setLoading(false)
  }, [isControlled, userId])

  useEffect(() => {
    if (isControlled) return
    void loadPools()
  }, [isControlled, loadPools])

  const resolvedPools = isControlled ? externalPools : pools
  const resolvedLoading = isControlled ? (externalLoading ?? false) : loading
  const resolvedError = isControlled ? externalError : error

  function handlePoolDeleted(poolId: string) {
    if (externalOnPoolDeleted) {
      externalOnPoolDeleted(poolId)
      return
    }

    setPools((prev) => prev.filter((pool) => pool.id !== poolId))
  }

  if (resolvedLoading) {
    return <ActivePoolsSkeleton />
  }

  if (resolvedError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-10 text-center">
        <p className="text-sm text-destructive">Could not load your pools.</p>
        <p className="mt-2 text-xs text-muted-foreground">{resolvedError}</p>
      </div>
    )
  }

  return (
    <>
      <div className={POOL_CAROUSEL_SCROLL_CLASS}>
        <div className={POOL_CAROUSEL_TRACK_CLASS}>
          {resolvedPools.map((pool) => (
            <div key={pool.id} className={POOL_CAROUSEL_ITEM_CLASS}>
              <PoolCard
                pool={pool}
                onPoolDeleted={handlePoolDeleted}
                surface="dashboard"
              />
            </div>
          ))}

          <div className={POOL_CAROUSEL_ITEM_CLASS}>
            <JoinOrCreatePoolCard />
          </div>
        </div>
      </div>

      {resolvedPools.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No pools yet — create one or join with an invite link from a friend.
        </p>
      )}
    </>
  )
}
