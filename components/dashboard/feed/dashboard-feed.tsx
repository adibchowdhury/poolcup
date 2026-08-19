import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DASHBOARD_HOME_PANEL_CLASS } from '@/components/dashboard/feed/dashboard-home-layout'

/** Strip panel chrome on mobile when a section uses the desktop panel wrapper. */
const DASHBOARD_SECTION_PANEL_MOBILE_RESET = cn(
  'max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:p-0',
)

/**
 * Vertical dashboard homepage feed.
 * Section order:
 * 1. Make Your Picks (above feed wrapper on home tab)
 * 2. Live Now
 * 3. Your Pools
 * 4. Discover Pools (OfficialPoolsSection)
 * 5. Global PoolCup Activity
 * 6. Friends Activity
 * 7. News & Highlights (RSS link-out teasers)
 */
type DashboardFeedProps = {
  children: ReactNode
  className?: string
}

export function DashboardFeed({ children, className }: DashboardFeedProps) {
  return (
    <div
      data-dashboard-feed
      className={cn('flex min-w-0 flex-col gap-8', className)}
    >
      {children}
    </div>
  )
}

type DashboardFeedSectionProps = {
  /** Stable section id for future targeting / analytics. */
  id: string
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  /** lg+ only: wrap section in the outlined transparent dashboard panel. */
  desktopPanel?: boolean
}

export function DashboardFeedSection({
  id,
  title,
  action,
  children,
  className,
  desktopPanel = false,
}: DashboardFeedSectionProps) {
  return (
    <section
      data-feed-section={id}
      className={cn(
        'flex min-w-0 flex-col gap-4',
        desktopPanel &&
          cn(DASHBOARD_HOME_PANEL_CLASS, DASHBOARD_SECTION_PANEL_MOBILE_RESET),
        className,
      )}
    >
      {title || action ? (
        <div className="flex flex-row items-center justify-between gap-3">
          {title ? (
            <h2 className="min-w-0 truncate font-display text-2xl tracking-wide text-foreground">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
