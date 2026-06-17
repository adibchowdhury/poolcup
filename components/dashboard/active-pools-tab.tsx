'use client'

import { useCallback, useEffect, useState } from 'react'
import { PoolCard, type DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { JoinOrCreatePoolCard } from '@/components/dashboard/join-or-create-pool-card'
import { ActivePoolsSkeleton } from '@/components/dashboard/pool-card-skeleton'
import { fetchDashboardPools } from '@/src/lib/fetch-dashboard-pools'
import { supabase } from '@/src/lib/supabase'

interface ActivePoolsTabProps {
  userId: string
}

export function ActivePoolsTab({ userId }: ActivePoolsTabProps) {
  const [pools, setPools] = useState<DashboardPoolCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPools = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { pools: rows, error: fetchError } = await fetchDashboardPools(
      supabase,
      userId,
    )

    setPools(rows)
    setError(fetchError)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void loadPools()
  }, [loadPools])

  function handlePoolDeleted(poolId: string) {
    setPools((prev) => prev.filter((p) => p.id !== poolId))
  }

  if (loading) {
    return <ActivePoolsSkeleton />
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-10 text-center">
        <p className="text-sm text-destructive">Could not load your pools.</p>
        <p className="mt-2 text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {pools.map((pool) => (
          <PoolCard
            key={pool.id}
            pool={pool}
            onPoolDeleted={handlePoolDeleted}
          />
        ))}

        <JoinOrCreatePoolCard />
      </div>

      {pools.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No pools yet — create one or join with an invite link from a friend.
        </p>
      )}
    </>
  )
}
