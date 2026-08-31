import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import { DASHBOARD_FEED_SURFACE_CLASS } from '@/src/lib/dashboard-surfaces'

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(DASHBOARD_FEED_SURFACE_CLASS, 'p-4', className)}>
      <ShimmerBlock className="h-3 w-24 rounded-md" />
      <ShimmerBlock className="mt-4 h-8 w-2/3 rounded-md" />
      <ShimmerBlock className="mt-3 h-4 w-full rounded-md" />
      <ShimmerBlock className="mt-2 h-4 w-4/5 rounded-md" />
    </div>
  )
}

export function PoolHomeSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5"
      aria-busy="true"
      aria-label="Loading pool home"
    >
      <CardSkeleton className="lg:col-span-2 min-h-[280px]" />
      <CardSkeleton className="min-h-[200px]" />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton className="lg:col-span-2 min-h-[180px]" />
    </div>
  )
}
