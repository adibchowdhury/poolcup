import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'

export function PoolCardSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card"
      aria-hidden
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <ShimmerBlock className="h-8 w-4/5 max-w-[280px]" />
            <div className="mt-2 flex items-center gap-2.5">
              <ShimmerBlock className="h-8 w-8 shrink-0 rounded-full" />
              <ShimmerBlock className="-ml-2 h-8 w-8 shrink-0 rounded-full" />
              <ShimmerBlock className="h-4 w-24" />
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <ShimmerBlock className="h-5 w-16 rounded-full" />
            <ShimmerBlock className="h-5 w-12 rounded-full" />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <ShimmerBlock className="h-[88px] rounded-xl" />
          <ShimmerBlock className="h-[88px] rounded-xl" />
        </div>

        <div className="mb-4">
          <div className="mb-1 flex justify-between gap-3">
            <ShimmerBlock className="h-3 w-32" />
            <ShimmerBlock className="h-3 w-12" />
          </div>
          <ShimmerBlock className="h-2 w-full rounded-full" />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4 sm:gap-3">
          <ShimmerBlock className="h-9 w-full rounded-md sm:w-36" />
          <ShimmerBlock className="h-9 w-full rounded-md sm:w-28" />
        </div>
      </div>
    </div>
  )
}

export function ActivePoolsSkeleton() {
  return (
    <div
      className={cn(
        '@container min-w-0 max-w-full -mx-4 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory',
        '[scroll-padding-inline:1rem] [-webkit-overflow-scrolling:touch]',
        '[scrollbar-width:thin]',
        '[&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25',
        '[&::-webkit-scrollbar-track]:bg-transparent',
      )}
      aria-busy="true"
      aria-label="Loading your pools"
    >
      <div className="flex w-max min-w-full gap-4 px-4 pb-1">
        <div className="w-[calc(100cqi/1.12)] max-w-[300px] shrink-0 snap-start sm:w-[280px] md:w-[300px] lg:w-[320px]">
          <PoolCardSkeleton />
        </div>
        <div className="w-[calc(100cqi/1.12)] max-w-[300px] shrink-0 snap-start sm:w-[280px] md:w-[300px] lg:w-[320px]">
          <PoolCardSkeleton />
        </div>
      </div>
    </div>
  )
}
