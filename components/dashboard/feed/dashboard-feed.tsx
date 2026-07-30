import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Vertical dashboard homepage feed.
 * Section order (pools tab; sport/event pills sit above this wrapper):
 * 1. Live Now
 * 2. Your Pools
 * 3. Discover Pools (OfficialPoolsSection)
 * 4. Your Progress (RecentResultsSection)
 * 5. Activity
 * 6. Global PoolCup Activity
 * 7. Friends Activity
 * 8. Achievements
 * 9. News & Highlights (RSS link-out teasers)
 */
type DashboardFeedProps = {
  children: ReactNode
  className?: string
}

export function DashboardFeed({ children, className }: DashboardFeedProps) {
  return (
    <div
      data-dashboard-feed
      className={cn('flex flex-col gap-8', className)}
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
}

export function DashboardFeedSection({
  id,
  title,
  action,
  children,
  className,
}: DashboardFeedSectionProps) {
  return (
    <section
      data-feed-section={id}
      className={cn('flex flex-col gap-4', className)}
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
