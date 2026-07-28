import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Vertical dashboard homepage feed.
 * Add new sections as children in order; replace old dashboard pieces only
 * after each section is verified.
 *
 * Planned section order:
 * 1. Live Now (when something is genuinely live)
 * 2. Your Pools
 * 3. Recent Results
 * 4. Global PoolCup Activity
 * 5. Upcoming matches (later)
 * …additional sections TBD
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
