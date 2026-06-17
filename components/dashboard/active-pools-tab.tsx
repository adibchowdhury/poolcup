'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PoolCard, type DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { JoinOrCreatePoolCard } from '@/components/dashboard/join-or-create-pool-card'
import { ActivePoolsSkeleton } from '@/components/dashboard/pool-card-skeleton'
import { fetchDashboardPools } from '@/src/lib/fetch-dashboard-pools'
import {
  fetchPoolUnreadCounts,
  POOL_MARKED_READ_EVENT,
} from '@/src/lib/pool-unread-counts'
import { supabase } from '@/src/lib/supabase'

interface ActivePoolsTabProps {
  userId: string
}

export function ActivePoolsTab({ userId }: ActivePoolsTabProps) {
  const pathname = usePathname()
  const [pools, setPools] = useState<DashboardPoolCardData[]>([])
  const [unreadByPoolId, setUnreadByPoolId] = useState<Map<string, number>>(
    () => new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshUnreadCounts = useCallback(async () => {
    const counts = await fetchPoolUnreadCounts(supabase)
    setUnreadByPoolId(counts)
  }, [])

  const loadPools = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [{ pools: rows, error: fetchError }, unreadCounts] = await Promise.all([
      fetchDashboardPools(supabase, userId),
      fetchPoolUnreadCounts(supabase),
    ])

    setPools(rows)
    setUnreadByPoolId(unreadCounts)
    setError(fetchError)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void loadPools()
  }, [loadPools])

  useEffect(() => {
    if (pathname !== '/dashboard') return
    void refreshUnreadCounts()
  }, [pathname, refreshUnreadCounts])

  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === 'visible' && pathname === '/dashboard') {
        void refreshUnreadCounts()
      }
    }

    window.addEventListener('focus', handleVisible)
    document.addEventListener('visibilitychange', handleVisible)
    return () => {
      window.removeEventListener('focus', handleVisible)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [pathname, refreshUnreadCounts])

  useEffect(() => {
    function handlePoolMarkedRead(event: Event) {
      const poolId = (event as CustomEvent<{ poolId: string }>).detail?.poolId
      if (!poolId) return

      setUnreadByPoolId((previous) => {
        const next = new Map(previous)
        next.set(poolId, 0)
        return next
      })
    }

    window.addEventListener(POOL_MARKED_READ_EVENT, handlePoolMarkedRead)
    return () => {
      window.removeEventListener(POOL_MARKED_READ_EVENT, handlePoolMarkedRead)
    }
  }, [])

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
            unreadCount={unreadByPoolId.get(pool.id) ?? 0}
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
