import { ShimmerBlock } from '@/components/ui/shimmer-block'

function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl p-4">
      <ShimmerBlock className="h-6 w-8 shrink-0 rounded-md" />
      <ShimmerBlock className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <ShimmerBlock className="h-4 w-32 max-w-[60%]" />
        <ShimmerBlock className="h-3 w-20" />
      </div>
      <div className="space-y-1.5 text-right">
        <ShimmerBlock className="ml-auto h-7 w-10 rounded-md" />
        <ShimmerBlock className="ml-auto h-3 w-6 rounded-md" />
      </div>
    </div>
  )
}

export function LeaderboardSkeleton({ rowCount = 5 }: { rowCount?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading leaderboard">
      <div className="mb-4 flex items-center gap-3">
        <ShimmerBlock className="h-6 w-6 shrink-0 rounded-md" />
        <ShimmerBlock className="h-7 w-40 max-w-[50%] rounded-md" />
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-1 bg-muted" />
        <div className="space-y-2 p-2">
          {Array.from({ length: rowCount }, (_, index) => (
            <LeaderboardRowSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
