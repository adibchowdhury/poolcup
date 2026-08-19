import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { HUB_DESKTOP_NAV_STRIP_CLASS } from '@/components/dashboard/hub-desktop-nav-frame'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { cn } from '@/lib/utils'

function HubPageHeaderSkeleton() {
  return (
    <>
      <div aria-hidden className="dashboard-header-top-gap w-full shrink-0" />
      <header className="border-b border-border bg-app-background/80 backdrop-blur-xl">
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
    </>
  )
}

function HubDesktopTabBarSkeleton() {
  return (
    <div className={HUB_DESKTOP_NAV_STRIP_CLASS} aria-hidden>
      <div className="mx-auto hidden h-auto w-full max-w-4xl grid-cols-5 gap-1 rounded-full border border-white/[0.08] bg-[#0A0E0E]/90 p-1.5 sm:grid">
        {Array.from({ length: 5 }).map((_, index) => (
          <ShimmerBlock key={index} className="h-10 rounded-full" />
        ))}
      </div>
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
      className="min-h-screen max-w-full min-w-0 overflow-x-clip bg-app-background"
      aria-busy="true"
      aria-label={label}
    >
      <div className="relative max-w-full min-w-0">
        <div className="z-50 bg-app-background md:sticky md:top-0">
          <HubPageHeaderSkeleton />
        </div>

        <div className="flex flex-col gap-8">
          <HubDesktopTabBarSkeleton />
          <main
            className={cn(
              'mx-auto w-full min-w-0 max-w-6xl px-4 pb-6 sm:pb-8 sm:pt-0',
              MOBILE_BOTTOM_NAV_PAD_CLASS,
              mainClassName,
            )}
          >
            <div className={cn(contentClassName)}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
