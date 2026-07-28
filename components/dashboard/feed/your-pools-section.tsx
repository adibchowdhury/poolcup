'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivePoolsTab } from '@/components/dashboard/active-pools-tab'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'

type YourPoolsSectionProps = {
  userId: string
  pools: DashboardPoolCardData[]
  loading: boolean
  error: string | null
  onPoolDeleted?: (poolId: string) => void
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
}: YourPoolsSectionProps) {
  return (
    <DashboardFeedSection
      id="your-pools"
      title="Your Pools"
      action={
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
      }
    >
      <ActivePoolsTab
        userId={userId}
        pools={pools}
        loading={loading}
        error={error}
        onPoolDeleted={onPoolDeleted}
      />
    </DashboardFeedSection>
  )
}
