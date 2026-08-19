import { ShimmerBlock } from '@/components/ui/shimmer-block'

export default function DiscoverLoading() {
  return (
    <div
      className="mx-auto w-full min-w-0 max-w-5xl space-y-5"
      aria-busy="true"
      aria-label="Loading discover"
    >
      <ShimmerBlock className="h-11 w-full rounded-md" />
      <div className="flex gap-2 overflow-hidden">
        <ShimmerBlock className="h-9 w-20 shrink-0 rounded-full" />
        <ShimmerBlock className="h-9 w-24 shrink-0 rounded-full" />
        <ShimmerBlock className="h-9 w-16 shrink-0 rounded-full" />
        <ShimmerBlock className="h-9 w-28 shrink-0 rounded-full" />
      </div>
      <ShimmerBlock className="h-6 w-40 rounded-md" />
      <div className="grid gap-3 sm:grid-cols-2">
        <ShimmerBlock className="h-36 w-full rounded-2xl" />
        <ShimmerBlock className="h-36 w-full rounded-2xl" />
        <ShimmerBlock className="h-36 w-full rounded-2xl" />
        <ShimmerBlock className="h-36 w-full rounded-2xl" />
      </div>
    </div>
  )
}
