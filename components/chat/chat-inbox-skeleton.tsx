import { ShimmerBlock } from '@/components/ui/shimmer-block'

function ChatInboxRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-1 py-3 sm:px-1.5" aria-hidden>
      <ShimmerBlock className="h-14 w-14 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1">
        <ShimmerBlock className="h-4 w-2/5 max-w-[180px] rounded-md" />
        <ShimmerBlock className="h-3.5 w-full max-w-[280px] rounded-md" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <ShimmerBlock className="h-3 w-10 rounded-md" />
        <ShimmerBlock className="h-4 w-4 rounded-full" />
      </div>
    </div>
  )
}

type ChatInboxSkeletonProps = {
  rows?: number
}

export function ChatInboxSkeleton({ rows = 4 }: ChatInboxSkeletonProps) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      <ShimmerBlock className="h-11 w-full rounded-full" />
      <div className="-mx-1 flex gap-5 overflow-x-auto px-1" aria-hidden>
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex w-[4.5rem] shrink-0 flex-col items-center gap-2"
          >
            <ShimmerBlock className="h-16 w-16 rounded-full" />
            <ShimmerBlock className="h-2.5 w-10 rounded-md" />
          </div>
        ))}
      </div>
      <ul className="flex flex-col" aria-busy="true" aria-label="Loading chats">
        {Array.from({ length: rows }).map((_, index) => (
          <li key={index}>
            <ChatInboxRowSkeleton />
          </li>
        ))}
      </ul>
    </div>
  )
}
