import { ShimmerBlock } from '@/components/ui/shimmer-block'

export function PoolSettingsHubSkeleton() {
  return (
    <div
      className="w-full min-w-0 space-y-3"
      aria-busy="true"
      aria-label="Loading pool settings"
    >
      <ShimmerBlock className="h-11 w-full rounded-xl" />
      <ShimmerBlock className="h-3 w-24 rounded-md" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className={index > 0 ? 'border-t border-border/70 px-4 py-3.5' : 'px-4 py-3.5'}
          >
            <ShimmerBlock className="h-5 w-40 rounded-md" />
            <ShimmerBlock className="mt-2 h-3 w-56 max-w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PoolSettingsSectionSkeleton() {
  return (
    <div
      className="w-full min-w-0 space-y-4"
      aria-busy="true"
      aria-label="Loading settings"
    >
      <div className="space-y-2">
        <ShimmerBlock className="h-8 w-48 rounded-md" />
        <ShimmerBlock className="h-4 w-72 max-w-full rounded-md" />
      </div>
      <div className="space-y-3">
        <ShimmerBlock className="h-24 w-full rounded-2xl" />
        <ShimmerBlock className="h-24 w-full rounded-2xl" />
        <ShimmerBlock className="h-32 w-full rounded-2xl" />
      </div>
    </div>
  )
}
