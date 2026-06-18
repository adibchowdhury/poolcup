import { ShimmerBlock } from '@/components/ui/shimmer-block'

function ChatInboxRowSkeleton() {
  return (
    <div
      className="flex gap-3 rounded-xl border border-border/90 bg-card/90 px-4 py-3.5"
      aria-hidden
    >
      <div className="min-w-0 flex-1 space-y-2">
        <ShimmerBlock className="h-[18px] w-2/5 max-w-[220px] rounded-md" />
        <div className="flex items-center">
          <ShimmerBlock className="h-7 w-7 shrink-0 rounded-full" />
          <ShimmerBlock className="-ml-2 h-7 w-7 shrink-0 rounded-full" />
          <ShimmerBlock className="-ml-2 h-7 w-7 shrink-0 rounded-full" />
        </div>
        <ShimmerBlock className="h-3.5 w-full max-w-[300px] rounded-md" />
      </div>
    </div>
  )
}

type ChatInboxSkeletonProps = {
  rows?: number
}

export function ChatInboxSkeleton({ rows = 4 }: ChatInboxSkeletonProps) {
  return (
    <ul
      className="mt-6 flex flex-col gap-2 sm:gap-2.5"
      aria-busy="true"
      aria-label="Loading chats"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index}>
          <ChatInboxRowSkeleton />
        </li>
      ))}
    </ul>
  )
}
