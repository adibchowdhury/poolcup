import { ShimmerBlock } from '@/components/ui/shimmer-block'

export default function FriendsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-lg space-y-5"
      aria-busy="true"
      aria-label="Loading social"
    >
      <div className="flex items-center justify-between gap-2">
        <ShimmerBlock className="h-9 w-32 rounded-md" />
        <ShimmerBlock className="h-8 w-28 rounded-md" />
      </div>
      <ShimmerBlock className="h-12 w-full rounded-xl" />
      <div className="space-y-3">
        <ShimmerBlock className="h-16 w-full rounded-xl" />
        <ShimmerBlock className="h-16 w-full rounded-xl" />
        <ShimmerBlock className="h-16 w-full rounded-xl" />
        <ShimmerBlock className="h-16 w-full rounded-xl" />
      </div>
    </div>
  )
}
