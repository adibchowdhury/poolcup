'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  Clock,
  MessageCircle,
  Minus,
  Plus,
  Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatUnreadCountBadge } from '@/components/chat/chat-unread-count-badge'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { DashboardPlainCard } from '@/components/dashboard/dashboard-plain-card'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { ordinalPlace } from '@/components/pool/leaderboard-grouped-list'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'
import {
  fetchYourPoolsFeed,
  type YourPoolsFeedItem,
} from '@/src/lib/fetch-your-pools-feed'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'
import { supabase } from '@/src/lib/supabase'

type YourPoolsSectionProps = {
  userId: string
}

function formatUpcomingDeadline(
  iso: string | null,
  nowMs: number,
  predictionsLocked: boolean,
): string {
  if (predictionsLocked || !iso) return 'No upcoming matches'
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return 'No upcoming matches'

  const diffMs = target - nowMs
  if (diffMs <= 0) return 'Locking soon'

  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 60) {
    return diffMin <= 1 ? 'Due in 1 min' : `Due in ${diffMin} min`
  }

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 48) {
    return diffHr === 1 ? 'Due in 1 hour' : `Due in ${diffHr} hours`
  }

  const diffDay = Math.floor(diffHr / 24)
  return diffDay === 1 ? 'Due in 1 day' : `Due in ${diffDay} days`
}

function RankMovementBadge({
  movement,
  rankDelta,
}: {
  movement: YourPoolsFeedItem['movement']
  rankDelta: number
}) {
  if (movement === 'up' && rankDelta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400">
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        {rankDelta}
        <span className="sr-only">places up</span>
      </span>
    )
  }

  if (movement === 'down' && rankDelta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-400">
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        {rankDelta}
        <span className="sr-only">places down</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">No rank change</span>
    </span>
  )
}

function YourPoolFeedRow({ pool }: { pool: YourPoolsFeedItem }) {
  const { mounted, nowMs } = useClientNow(30_000)
  const deadlineLabel = mounted
    ? formatUpcomingDeadline(
        pool.nextMatchKickoffAt,
        nowMs,
        pool.predictionsLocked,
      )
    : '…'
  const rankLabel =
    pool.yourRank != null ? ordinalPlace(pool.yourRank) : 'Unranked'
  const href = `/pool/${pool.inviteCode}`

  return (
    <Link
      href={href}
      className="block rounded-xl border border-border/70 bg-background/40 px-3.5 py-3 transition-colors hover:border-border hover:bg-muted/30 sm:px-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-xl tracking-wide text-foreground">
              {pool.name}
            </h3>
            <ChatUnreadCountBadge count={pool.unreadCount} size="sm" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatScoringStyleLabel(pool.scoringStyle)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
            <Trophy className="h-3.5 w-3.5 text-[#ffb300]" aria-hidden />
            {rankLabel}
          </span>
          <RankMovementBadge
            movement={pool.movement}
            rankDelta={pool.rankDelta}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {deadlineLabel}
        </span>
        {pool.unreadCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-primary">
            <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {pool.unreadCount === 1
              ? '1 unread message'
              : `${pool.unreadCount} unread messages`}
          </span>
        ) : null}
      </div>
    </Link>
  )
}

function YourPoolsFeedSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-border/70 px-3.5 py-3 sm:px-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-6 w-2/3 max-w-[220px]" />
              <ShimmerBlock className="h-3 w-24" />
            </div>
            <div className="space-y-2">
              <ShimmerBlock className="h-4 w-14" />
              <ShimmerBlock className="ml-auto h-3 w-8" />
            </div>
          </div>
          <ShimmerBlock className="mt-3 h-3 w-36" />
        </div>
      ))}
    </div>
  )
}

export function YourPoolsSection({ userId }: YourPoolsSectionProps) {
  const [pools, setPools] = useState<YourPoolsFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { pools: nextPools, error: fetchError } = await fetchYourPoolsFeed(
      supabase,
      userId,
    )
    setPools(nextPools)
    setError(fetchError)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <DashboardFeedSection
      id="your-pools"
      title="Your Pools"
      action={
        <Button
          asChild
          size="sm"
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 group"
        >
          <Link href="/create">
            <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
            Create a Pool
          </Link>
        </Button>
      }
    >
      <DashboardPlainCard className={cn(loading && 'min-h-[140px]')}>
        {loading ? (
          <YourPoolsFeedSkeleton />
        ) : error ? (
          <div className="space-y-3 py-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : pools.length === 0 ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              You&apos;re not in any pools yet. Create one or join with an invite
              code.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="sm" className="gap-2">
                <Link href="/create">
                  <Plus className="h-4 w-4" />
                  Create a Pool
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {pools.map((pool) => (
              <li key={pool.id}>
                <YourPoolFeedRow pool={pool} />
              </li>
            ))}
          </ul>
        )}
      </DashboardPlainCard>
    </DashboardFeedSection>
  )
}
