import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { cn } from '@/lib/utils'

function HubPageHeaderSkeleton() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <ShimmerBlock className="h-8 w-28 shrink-0 rounded-md sm:h-9 sm:w-32" />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ShimmerBlock className="h-9 w-9 shrink-0 rounded-lg" />
            <ShimmerBlock className="h-9 w-9 shrink-0 rounded-lg sm:hidden" />
            <ShimmerBlock className="hidden h-9 w-28 shrink-0 rounded-lg sm:block" />
          </div>
        </div>
      </div>
    </header>
  )
}

function HubDesktopTabBarSkeleton() {
  return (
    <div
      className="mx-auto hidden h-auto w-full max-w-4xl grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid sm:grid-cols-5"
      aria-hidden
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <ShimmerBlock key={index} className="h-10 rounded-md" />
      ))}
    </div>
  )
}

type HubPageLoadingShellProps = {
  children: React.ReactNode
  mainClassName?: string
  contentClassName?: string
  label: string
}

export function HubPageLoadingShell({
  children,
  mainClassName,
  contentClassName,
  label,
}: HubPageLoadingShellProps) {
  return (
    <div
      className="min-h-screen bg-background"
      aria-busy="true"
      aria-label={label}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-20 top-40 h-96 w-96 rounded-full bg-[#ffb300]/5 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="z-50 md:sticky md:top-0">
          <HubPageHeaderSkeleton />
        </div>

        <main
          className={cn(
            'mx-auto max-w-6xl px-4 py-8',
            MOBILE_BOTTOM_NAV_PAD_CLASS,
            mainClassName,
          )}
        >
          <div className={cn('flex flex-col gap-8 sm:gap-10', contentClassName)}>
            <HubDesktopTabBarSkeleton />
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
