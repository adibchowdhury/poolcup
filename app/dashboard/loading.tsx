import { ActivePoolsSkeleton } from '@/components/dashboard/pool-card-skeleton'
import { HubPageLoadingShell } from '@/components/dashboard/hub-page-loading-shell'
import { ShimmerBlock } from '@/components/ui/shimmer-block'

export default function DashboardLoading() {
  return (
    <HubPageLoadingShell label="Loading dashboard">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ShimmerBlock className="h-8 w-56 max-w-[70%] rounded-md" />
          <ShimmerBlock className="h-10 w-full rounded-md sm:w-36" />
        </div>
        <ActivePoolsSkeleton />
      </div>
    </HubPageLoadingShell>
  )
}
