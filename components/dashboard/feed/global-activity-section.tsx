'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  PlusCircle,
  Target,
  UserPlus,
} from 'lucide-react'
import { DashboardFeedSection } from '@/components/dashboard/feed/dashboard-feed'
import { cn } from '@/lib/utils'
import { DASHBOARD_FEED_SURFACE_CLASS } from '@/components/dashboard/feed/dashboard-home-layout'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import {
  fetchGlobalActivityFeed,
  type GlobalActivityFeedData,
  type GlobalActivityItem,
} from '@/src/lib/fetch-global-activity-feed'

type GlobalActivitySectionProps = {
  userId: string
  /** Compact heading for desktop home rail; omits outer plain card wrapper. */
  layout?: 'feed' | 'rail'
  className?: string
}

function activityEyebrow(type: GlobalActivityItem['type']): string {
  switch (type) {
    case 'picks_summary':
      return 'Picks'
    case 'pools_created_summary':
      return 'New pools'
    case 'pool_joins_summary':
      return 'Pool joins'
    case 'upcoming_matches':
      return 'Coming up'
    default:
      return 'Activity'
  }
}

function activityIcon(type: GlobalActivityItem['type']) {
  switch (type) {
    case 'picks_summary':
      return Target
    case 'pools_created_summary':
      return PlusCircle
    case 'pool_joins_summary':
      return UserPlus
    case 'upcoming_matches':
      return CalendarDays
    default:
      return Target
  }
}

export function GlobalActivityItemCard({
  item,
  plain = false,
}: {
  item: GlobalActivityItem
  /** Mobile dashboard feed — no card surface; desktop rail uses default cards. */
  plain?: boolean
}) {
  const Icon = activityIcon(item.type)
  const href = item.poolInviteCode
    ? `/pool/${item.poolInviteCode}`
    : '/discover'

  return (
    <div
      className={cn(
        plain
          ? 'py-2'
          : cn(DASHBOARD_FEED_SURFACE_CLASS, 'px-3 py-2.5 sm:px-3.5'),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            {activityEyebrow(item.type)}
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground">
            {item.headline}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{item.subline}</p>
        </div>
        {item.poolInviteCode ? (
          <Link
            href={href}
            className="shrink-0 rounded-sm text-[11px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            View
          </Link>
        ) : null}
      </div>
    </div>
  )
}

export function GlobalActivitySkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <ShimmerBlock key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  )
}

function GlobalActivitySparseHint() {
  return (
    <p className="px-1 text-center text-xs text-muted-foreground">
      Quiet right now — be the first to make your picks.
    </p>
  )
}

/**
 * Aggregate pool activity — counts and summaries, no personal attribution.
 * Full list: /activity
 */
export function GlobalActivitySection({
  userId,
  layout = 'feed',
  className,
}: GlobalActivitySectionProps) {
  const [data, setData] = useState<GlobalActivityFeedData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const next = await fetchGlobalActivityFeed(userId, { scope: 'dashboard' })
    setData(next)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const body =
    loading && !data ? (
      <GlobalActivitySkeleton />
    ) : data?.error && data.isEmpty ? (
      <div className="space-y-3 py-1 text-center">
        <p className="text-sm text-destructive">{data.error}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
        >
          Try again
        </Button>
      </div>
    ) : data ? (
      <div className={cn(layout === 'feed' ? 'space-y-2.5' : 'space-y-2')}>
        {data.items.map((item) => (
          <GlobalActivityItemCard
            key={item.id}
            item={item}
            plain={layout === 'feed'}
          />
        ))}
        {data.isSparse ? <GlobalActivitySparseHint /> : null}
        {data.isEmpty && !data.error ? (
          <div className="space-y-2 py-2">
            <p className="text-center text-sm text-muted-foreground">
              No recent pool activity yet.
            </p>
            <GlobalActivitySparseHint />
          </div>
        ) : null}
      </div>
    ) : null

  if (layout === 'rail') {
    return (
      <section
        data-feed-section="global-activity"
        data-layout="rail"
        className={cn('min-w-0 space-y-3', className)}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate font-display text-lg leading-none tracking-wide text-foreground">
            Pool Activity
          </h2>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
          >
            <Link href="/activity">
              View all
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
        {body}
      </section>
    )
  }

  return (
    <DashboardFeedSection
      id="global-activity"
      title="Pool Activity"
      className={className}
      action={
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/activity">
            View All
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      }
    >
      {body}
    </DashboardFeedSection>
  )
}
