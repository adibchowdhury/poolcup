import { ShimmerBlock } from '@/components/ui/shimmer-block'

function PoolStatBlockSkeleton() {
  return <ShimmerBlock className="h-24 w-full rounded-2xl" />
}

export function PoolPageSkeleton() {
  return (
    <div
      className="min-h-screen bg-background"
      aria-busy="true"
      aria-label="Loading pool"
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-20 top-40 h-96 w-96 rounded-full bg-[#ffb300]/5 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <div className="flex items-center gap-4">
              <ShimmerBlock className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <ShimmerBlock className="h-8 w-56 max-w-[70%] rounded-md sm:h-9" />
                <ShimmerBlock className="h-4 w-32 rounded-md" />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8">
          <ShimmerBlock className="mb-8 h-[72px] w-full rounded-2xl" />

          <div className="mb-8 grid h-auto w-full max-w-xl grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <ShimmerBlock className="h-10 rounded-md" />
            <ShimmerBlock className="h-10 rounded-md" />
          </div>

          <div className="space-y-4">
            <PoolStatBlockSkeleton />
            <PoolStatBlockSkeleton />
            <PoolStatBlockSkeleton />
          </div>
        </main>
      </div>
    </div>
  )
}
