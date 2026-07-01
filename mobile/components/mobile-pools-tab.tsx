'use client'

import { Plus, Sparkles } from 'lucide-react'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import {
  ComingSoonToast,
  useComingSoonToast,
} from '../lib/use-coming-soon-toast'
import { MobileDashboardInsights } from './mobile-dashboard-insights'
import { MobileLiveScoreboard } from './mobile-live-scoreboard'
import { MobilePoolCard } from './mobile-pool-card'

type MobilePoolsTabProps = {
  pools: DashboardPoolCardData[]
  poolsLoading: boolean
  poolsError: string | null
  onOpenPool: (pool: DashboardPoolCardData) => void
  onOpenMatch: (matchId: string) => void
}

export function MobilePoolsTab({
  pools,
  poolsLoading,
  poolsError,
  onOpenPool,
  onOpenMatch,
}: MobilePoolsTabProps) {
  const { comingSoonMessage, showComingSoon } = useComingSoonToast()

  return (
    <>
      <ComingSoonToast message={comingSoonMessage} />

      <div className="mx-auto w-full max-w-lg space-y-4">
        <MobileLiveScoreboard onOpenMatch={onOpenMatch} />

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-[#ffb300]" aria-hidden />
            <h2 className="font-display text-2xl tracking-wide text-foreground">
              Your Active Pools
            </h2>
          </div>
          <button
            type="button"
            onClick={() => showComingSoon()}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create a Pool
          </button>
        </div>

        {poolsLoading ? (
          <p className="text-sm text-muted-foreground">Loading pools…</p>
        ) : poolsError ? (
          <p className="text-sm text-destructive" role="alert">
            {poolsError}
          </p>
        ) : pools.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pools yet</p>
        ) : (
          <ul className="space-y-3">
            {pools.map((pool) => (
              <li key={pool.id}>
                <MobilePoolCard
                  pool={pool}
                  onOpen={() => onOpenPool(pool)}
                  onPredictStub={() => showComingSoon()}
                />
              </li>
            ))}
          </ul>
        )}

        <MobileDashboardInsights
          onStubAction={() => showComingSoon()}
          onOpenMatch={onOpenMatch}
        />
      </div>
    </>
  )
}
