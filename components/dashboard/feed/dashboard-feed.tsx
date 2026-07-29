import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Vertical dashboard homepage feed.
 * Section order (pools tab; sport/event pills sit above this wrapper):
 * 1. Live Now
 * 2. Your Pools
 * 3. Continue Playing
 * 4. Daily Challenge
 * 5. Discover Pools (OfficialPoolsSection)
 * 6. Your Progress (RecentResultsSection)
 * 7. Activity
 * 8. Global PoolCup Activity
 * 9. Friends Activity
 * 10. Achievements
 * 11. Trending
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
