import { ShimmerBlock } from '@/components/ui/shimmer-block'

function PlaceGroupSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <ShimmerBlock className="h-6 w-6 shrink-0 rounded-full" />
        <ShimmerBlock className="h-4 w-28 rounded-md" />
      </div>
      <div className="border-t border-border/60 bg-card/40">
        {Array.from({ length: rowCount }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-t border-border/60 px-3 py-3 first:border-t-0 sm:gap-4 sm:px-4"
          >
            <ShimmerBlock className="h-9 w-9 shrink-0 rounded-full sm:h-10 sm:w-10" />
            <ShimmerBlock className="h-4 flex-1 max-w-[40%] rounded-md" />
            <ShimmerBlock className="h-4 w-14 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function LeaderboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading leaderboard">
      <div className="mb-4 flex items-center gap-3">
        <ShimmerBlock className="h-6 w-6 shrink-0 rounded-md" />
        <ShimmerBlock className="h-7 w-40 max-w-[50%] rounded-md" />
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-1 bg-muted" />
        <div className="space-y-3 px-2 pb-2 pt-2 sm:space-y-4 sm:px-3">
          <PlaceGroupSkeleton rowCount={1} />
          <PlaceGroupSkeleton rowCount={2} />
        </div>
      </div>
    </div>
  )
}
