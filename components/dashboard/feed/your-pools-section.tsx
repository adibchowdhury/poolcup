'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivePoolsTab } from '@/components/dashboard/active-pools-tab'
import { DashboardFeedSection } from '@/components/dashboard/feed/dashboard-feed'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'

const DESKTOP_POOL_PREVIEW = 6

type YourPoolsSectionProps = {
  userId: string
  pools: DashboardPoolCardData[]
  loading: boolean
  error: string | null
  onPoolDeleted?: (poolId: string) => void
  desktopPanel?: boolean
}

/**
 * Your Pools feed section — full original PoolCards (same as former Active Pools).
 */
export function YourPoolsSection({
  userId,
  pools,
  loading,
  error,
  onPoolDeleted,
  desktopPanel = false,
}: YourPoolsSectionProps) {
  const [showAllDesktopPools, setShowAllDesktopPools] = useState(false)

  const hasMoreDesktopPools = pools.length > DESKTOP_POOL_PREVIEW
  const desktopPreviewLimit =
    showAllDesktopPools || !hasMoreDesktopPools ? undefined : DESKTOP_POOL_PREVIEW

  return (
    <DashboardFeedSection
      id="your-pools"
      title="Your Pools"
      desktopPanel={desktopPanel}
      action={
        <>
          <div className="hidden items-center gap-2 lg:flex">
            {hasMoreDesktopPools ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowAllDesktopPools((open) => !open)}
              >
                {showAllDesktopPools ? 'Show fewer' : 'View all'}
              </Button>
            ) : null}
            <Button
              asChild
              size="sm"
              className="gap-1.5 bg-primary px-2.5 text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/create">
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">Create Pool</span>
              </Link>
            </Button>
          </div>
          <div className="lg:hidden">
            <Button
              asChild
              size="sm"
              className="gap-1.5 bg-primary px-2.5 text-primary-foreground hover:bg-primary/90 group sm:gap-2 sm:px-3"
            >
              <Link href="/create">
                <Plus className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:rotate-90" />
                <span className="whitespace-nowrap">Create a Pool</span>
              </Link>
            </Button>
          </div>
        </>
      }
    >
      <ActivePoolsTab
        userId={userId}
        pools={pools}
        loading={loading}
        error={error}
        onPoolDeleted={onPoolDeleted}
        desktopPreviewLimit={desktopPreviewLimit}
      />
    </DashboardFeedSection>
  )
}
