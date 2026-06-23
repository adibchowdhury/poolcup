'use client'

import { PoolCard, type DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { JoinOrCreatePoolCard } from '@/components/dashboard/join-or-create-pool-card'
import { ActivePoolsSkeleton } from '@/components/dashboard/pool-card-skeleton'
import { fetchDashboardPools } from '@/src/lib/fetch-dashboard-pools'
import { supabase } from '@/src/lib/supabase'
import { useCallback, useEffect, useState } from 'react'

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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {resolvedPools.map((pool) => (
          <PoolCard
            key={pool.id}
            pool={pool}
            onPoolDeleted={handlePoolDeleted}
          />
        ))}

        <JoinOrCreatePoolCard />
      </div>

      {resolvedPools.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No pools yet — create one or join with an invite link from a friend.
        </p>
      )}
    </>
  )
}
