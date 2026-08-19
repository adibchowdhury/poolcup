import { ShimmerBlock } from '@/components/ui/shimmer-block'
import {
  HUB_DESKTOP_SIDEBAR_CLASS,
  HUB_DESKTOP_SIDEBAR_WIDTH_CLASS,
} from '@/components/dashboard/hub-desktop-nav-frame'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { cn } from '@/lib/utils'

function HubMobileHeaderSkeleton() {
  return (
    <>
      <div aria-hidden className="dashboard-header-top-gap w-full shrink-0" />
      <header className="border-b border-border bg-app-background/80 backdrop-blur-xl lg:hidden">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex h-14 items-center justify-between gap-2">
            <ShimmerBlock className="h-10 w-10 shrink-0 rounded-lg" />
            <ShimmerBlock className="h-8 w-28 shrink-0 rounded-md" />
            <div className="flex items-center gap-1.5">
              <ShimmerBlock className="h-9 w-9 shrink-0 rounded-lg" />
              <ShimmerBlock className="h-9 w-9 shrink-0 rounded-lg" />
              <ShimmerBlock className="h-9 w-9 shrink-0 rounded-full" />
            </div>
          </div>
        </div>
      </header>
    </>
  )
}

function HubDesktopSidebarSkeleton() {
  return (
    <>
      <aside
        className={cn(HUB_DESKTOP_SIDEBAR_CLASS, HUB_DESKTOP_SIDEBAR_WIDTH_CLASS)}
        aria-hidden
      >
        <div className="flex h-full flex-col px-3 py-5">
          <ShimmerBlock className="mx-1 mb-6 h-9 w-32 rounded-md" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-10 w-full rounded-lg" />
            ))}
            <ShimmerBlock className="h-10 w-full rounded-lg" />
            <ShimmerBlock className="h-10 w-full rounded-lg" />
            <ShimmerBlock className="h-10 w-full rounded-lg" />
          </div>
          <div className="mt-auto space-y-2 border-t border-white/[0.08] pt-4">
            <ShimmerBlock className="h-10 w-full rounded-lg" />
            <ShimmerBlock className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </aside>
      <div
        className={cn('hidden shrink-0 lg:block', HUB_DESKTOP_SIDEBAR_WIDTH_CLASS)}
        aria-hidden
      />
    </>
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
      className="min-h-screen max-w-full min-w-0 overflow-x-clip bg-app-background lg:flex"
      aria-busy="true"
      aria-label={label}
    >
      <HubDesktopSidebarSkeleton />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="z-50 shrink-0 bg-app-background">
          <HubMobileHeaderSkeleton />
        </div>

        <main
          className={cn(
            'mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 lg:py-8',
            MOBILE_BOTTOM_NAV_PAD_CLASS,
            mainClassName,
          )}
        >
          <div className={cn(contentClassName)}>{children}</div>
        </main>
      </div>
    </div>
  )
}
