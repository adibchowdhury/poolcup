import { Calendar } from 'lucide-react'
import { ShimmerBlock } from '@/components/ui/shimmer-block'

function UpcomingMatchCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.06] px-3 py-3.5 sm:rounded-[1.25rem] sm:px-5 sm:py-4 shadow-[0_2px_14px_rgba(0,0,0,0.32)]"
      aria-hidden
    >
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <ShimmerBlock className="h-3 w-16 rounded-md sm:h-3.5 sm:w-20" />
        <ShimmerBlock className="h-5 w-[5.5rem] shrink-0 rounded-full" />
      </div>

      <div className="flex items-center gap-1 sm:hidden">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <ShimmerBlock className="aspect-[3/2] h-[3.75rem] w-[5.625rem] shrink-0 rounded-sm" />
          <ShimmerBlock className="h-4 w-[85%] rounded-md" />
        </div>

        <ShimmerBlock className="h-2.5 w-4 shrink-0 self-center rounded-sm" />

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <ShimmerBlock className="aspect-[3/2] h-[3.75rem] w-[5.625rem] shrink-0 rounded-sm" />
          <ShimmerBlock className="h-4 w-[85%] rounded-md" />
        </div>
      </div>

      <div className="hidden items-center sm:flex">
        <ShimmerBlock className="aspect-[3/2] h-[5.5rem] w-[8.25rem] shrink-0 rounded-sm md:h-[6.5rem] md:w-[9.75rem]" />

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-1 md:px-2">
          <ShimmerBlock className="h-8 w-24 shrink rounded-md md:h-9" />
          <ShimmerBlock className="h-2.5 w-4 shrink-0 rounded-sm" />
          <ShimmerBlock className="h-8 w-24 shrink rounded-md md:h-9" />
        </div>

        <ShimmerBlock className="aspect-[3/2] h-[5.5rem] w-[8.25rem] shrink-0 rounded-sm md:h-[6.5rem] md:w-[9.75rem]" />
      </div>

      <div className="mt-3 flex justify-center sm:mt-3.5">
        <ShimmerBlock className="h-3.5 w-40 max-w-[75%] rounded-md" />
      </div>
    </div>
  )
}

function UpcomingDateGroupSkeleton() {
  return (
    <div>
      <div className="mb-2.5 sm:mb-3">
        <div className="flex items-end justify-between gap-3">
          <ShimmerBlock className="h-7 w-52 max-w-[70%] rounded-md sm:h-8" />
          <ShimmerBlock className="h-3.5 w-16 shrink-0 rounded-md" />
        </div>
        <div className="mt-2 h-px w-full bg-border/60" aria-hidden />
      </div>
      <div className="space-y-2.5">
        <UpcomingMatchCardSkeleton />
        <UpcomingMatchCardSkeleton />
      </div>
    </div>
  )
}

export function UpcomingGamesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl" aria-busy="true" aria-label="Loading upcoming matches">
      <header className="mb-5 border-b border-border/50 pb-4 sm:mb-6">
        <div className="flex items-start gap-3">
          <Calendar className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <ShimmerBlock className="h-9 w-56 max-w-[85%] rounded-md sm:h-10" />
            <ShimmerBlock className="mt-2 h-4 w-full max-w-md rounded-md" />
          </div>
        </div>
      </header>

      <div className="space-y-5 sm:space-y-6">
        <UpcomingDateGroupSkeleton />
        <UpcomingDateGroupSkeleton />
      </div>
    </div>
  )
}
