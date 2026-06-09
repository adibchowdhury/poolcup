import { ShimmerBlock } from '@/components/ui/shimmer-block'

function PodiumSlotSkeleton({
  pedestalClass,
  elevated = false,
}: {
  pedestalClass: string
  elevated?: boolean
}) {
  return (
    <div
      className={
        elevated ? 'flex min-w-0 flex-1 flex-col items-center -mt-4 sm:-mt-6' : 'flex min-w-0 flex-1 flex-col items-center'
      }
    >
      <div className="flex w-full max-w-[140px] flex-col items-center px-1 sm:max-w-[160px]">
        <ShimmerBlock className="mb-2 h-6 w-6 rounded-full" />
        <ShimmerBlock className="h-14 w-14 rounded-full sm:h-16 sm:w-16" />
        <ShimmerBlock className="mt-2 h-4 w-20" />
        <ShimmerBlock className="mt-1 h-7 w-10" />
        <div className="mt-2 w-full space-y-1">
          <ShimmerBlock className="h-3 w-16" />
          <ShimmerBlock className="h-1 w-full rounded-full" />
          <ShimmerBlock className="h-3 w-8" />
        </div>
      </div>
      <ShimmerBlock
        className={`mt-3 w-full rounded-t-xl ${pedestalClass}`}
      />
    </div>
  )
}

function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl p-4">
      <ShimmerBlock className="h-6 w-8 shrink-0 rounded-md" />
      <ShimmerBlock className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <ShimmerBlock className="h-4 w-32 max-w-[60%]" />
        <ShimmerBlock className="h-3 w-16" />
        <ShimmerBlock className="h-1 w-full max-w-xs rounded-full" />
        <ShimmerBlock className="h-3 w-8" />
      </div>
      <div className="space-y-1.5 text-right">
        <ShimmerBlock className="ml-auto h-7 w-10 rounded-md" />
        <ShimmerBlock className="ml-auto h-3 w-6 rounded-md" />
      </div>
    </div>
  )
}

export function LeaderboardSkeleton({ rowCount = 2 }: { rowCount?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading leaderboard">
      <div className="mb-4 flex items-center gap-3">
        <ShimmerBlock className="h-6 w-6 shrink-0 rounded-md" />
        <ShimmerBlock className="h-7 w-40 max-w-[50%] rounded-md" />
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-1 bg-muted" />

        <div className="grid grid-cols-3 items-end gap-1 px-2 pb-2 pt-4 sm:gap-3 sm:px-4 sm:pt-6">
          <PodiumSlotSkeleton pedestalClass="h-14 sm:h-16" />
          <PodiumSlotSkeleton pedestalClass="h-20 sm:h-24" elevated />
          <PodiumSlotSkeleton pedestalClass="h-10 sm:h-12" />
        </div>

        <div className="space-y-2 border-t border-border px-2 pb-2 pt-4">
          {Array.from({ length: rowCount }, (_, index) => (
            <LeaderboardRowSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
