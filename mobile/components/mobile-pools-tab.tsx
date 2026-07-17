'use client'

import { Plus, Sparkles, UserPlus } from 'lucide-react'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import {
  ComingSoonToast,
  useComingSoonToast,
} from '../lib/use-coming-soon-toast'
import { MobileDashboardInsights } from './mobile-dashboard-insights'
import { MobilePoolsScoreboardRow } from './mobile-pools-scoreboard-row'
import { MobilePoolCard } from './mobile-pool-card'

type MobilePoolsTabProps = {
  pools: DashboardPoolCardData[]
  poolsLoading: boolean
  poolsError: string | null
  onOpenPool: (pool: DashboardPoolCardData) => void
  onOpenMatch: (matchId: string) => void
  onJoinPool: () => void
}

export function MobilePoolsTab({
  pools,
  poolsLoading,
  poolsError,
  onOpenPool,
  onOpenMatch,
  onJoinPool,
}: MobilePoolsTabProps) {
  const { comingSoonMessage, showComingSoon } = useComingSoonToast()

  return (
    <>
      <ComingSoonToast message={comingSoonMessage} />

      <div className="mx-auto w-full max-w-lg space-y-4">
        <MobilePoolsScoreboardRow onOpenMatch={onOpenMatch} />

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-[#ffb300]" aria-hidden />
            <h2 className="font-display text-2xl tracking-wide text-foreground">
              Your Active Pools
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onJoinPool}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Join
            </button>
            <button
              type="button"
              onClick={() => showComingSoon()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create
            </button>
          </div>
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
          <div
            className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <ul className="flex w-max flex-nowrap gap-3">
              {pools.map((pool) => (
                <li
                  key={pool.id}
                  className="w-[85vw] max-w-[22rem] shrink-0 snap-start"
                >
                  <MobilePoolCard
                    pool={pool}
                    onOpen={() => onOpenPool(pool)}
                    onPredictStub={() => showComingSoon()}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <MobileDashboardInsights
          onStubAction={() => showComingSoon()}
          onOpenMatch={onOpenMatch}
        />
      </div>
    </>
  )
}
