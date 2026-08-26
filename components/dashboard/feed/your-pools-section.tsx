'use client'

import { useRouter } from 'next/navigation'
import { useState, type MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivePoolsTab } from '@/components/dashboard/active-pools-tab'
import { DashboardFeedSection } from '@/components/dashboard/feed/dashboard-feed'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { startCreatePoolEntryFromClick } from '@/src/lib/create-pool-transition'
import { useCreatePoolModalOptional } from '@/components/create/create-pool-modal'
import { cn } from '@/lib/utils'

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
  const router = useRouter()
  const createModal = useCreatePoolModalOptional()
  const [showAllDesktopPools, setShowAllDesktopPools] = useState(false)
  const [enteringCreate, setEnteringCreate] = useState(false)

  const hasMoreDesktopPools = pools.length > DESKTOP_POOL_PREVIEW
  const desktopPreviewLimit =
    showAllDesktopPools || !hasMoreDesktopPools ? undefined : DESKTOP_POOL_PREVIEW

  function handleCreatePoolClick(event: MouseEvent<HTMLButtonElement>) {
    if (enteringCreate) return
    setEnteringCreate(true)
    startCreatePoolEntryFromClick(router, event.currentTarget, {
      openModal: createModal
        ? () => {
            setEnteringCreate(false)
            createModal.openCreatePoolModal()
          }
        : undefined,
    })
    if (createModal && typeof window !== 'undefined') {
      // Desktop modal path never navigates — clear local pending flag.
      window.setTimeout(() => setEnteringCreate(false), 0)
    }
  }

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
              type="button"
              size="sm"
              disabled={enteringCreate}
              onClick={handleCreatePoolClick}
              className={cn(
                'create-pool-entry-btn gap-1.5 bg-primary px-2.5 text-primary-foreground hover:bg-primary/90',
              )}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">Create Pool</span>
            </Button>
          </div>
          <div className="lg:hidden">
            <Button
              type="button"
              size="sm"
              disabled={enteringCreate}
              onClick={handleCreatePoolClick}
              className={cn(
                'create-pool-entry-btn gap-1.5 bg-primary px-2.5 text-primary-foreground hover:bg-primary/90 group sm:gap-2 sm:px-3',
              )}
            >
              <Plus className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:rotate-90" />
              <span className="whitespace-nowrap">Create a Pool</span>
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
