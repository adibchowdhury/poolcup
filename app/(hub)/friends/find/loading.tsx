import { ShimmerBlock } from '@/components/ui/shimmer-block'

export default function FriendsFindLoading() {
  return (
    <div
      className="mx-auto w-full max-w-lg space-y-4"
      aria-busy="true"
      aria-label="Loading find friends"
    >
      <ShimmerBlock className="h-9 w-48 rounded-md" />
      <ShimmerBlock className="h-4 w-full rounded-md" />
      <ShimmerBlock className="h-11 w-full rounded-md" />
    </div>
  )
}
