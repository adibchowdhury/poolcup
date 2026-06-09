import { ShimmerBlock } from '@/components/ui/shimmer-block'

function UpcomingMatchCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <ShimmerBlock className="h-6 w-24 rounded-md" />
      </div>

      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:justify-start">
          <ShimmerBlock className="h-6 w-8 shrink-0 rounded-sm" />
          <ShimmerBlock className="h-5 w-28 max-w-[45%] rounded-md" />
        </div>

        <ShimmerBlock className="mx-auto h-3 w-6 shrink-0 rounded-sm sm:mx-0" />

        <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:justify-end">
          <ShimmerBlock className="h-5 w-28 max-w-[45%] rounded-md" />
          <ShimmerBlock className="h-6 w-8 shrink-0 rounded-sm" />
        </div>
      </div>

      <div className="mt-4 flex justify-center sm:justify-start">
        <ShimmerBlock className="h-4 w-44 max-w-[80%] rounded-md" />
      </div>
    </div>
  )
}

function UpcomingDateGroupSkeleton() {
  return (
    <div className="space-y-3">
      <ShimmerBlock className="h-7 w-56 max-w-[75%] rounded-md sm:h-8" />
      <div className="space-y-3">
        <UpcomingMatchCardSkeleton />
        <UpcomingMatchCardSkeleton />
        <UpcomingMatchCardSkeleton />
      </div>
    </div>
  )
}

export function UpcomingGamesSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading upcoming matches">
      <UpcomingDateGroupSkeleton />
      <UpcomingDateGroupSkeleton />
    </div>
  )
}
