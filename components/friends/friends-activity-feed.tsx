'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Award,
  Loader2,
  Sparkles,
  Target,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  getFriendActivityFeed,
  type FriendActivityRow,
} from '@/src/lib/friendships'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 15

function activityRowKey(item: FriendActivityRow, index: number): string {
  return [
    item.activity_type,
    item.actor_id,
    item.ref_id ?? '',
    item.occurred_at,
    String(index),
  ].join(':')
}

function ActivityTypeIcon({ type }: { type: FriendActivityRow['activity_type'] }) {
  if (type === 'badge') {
    return <Award className="h-3.5 w-3.5 text-amber-400" aria-hidden />
  }
  if (type === 'prediction_result') {
    return <Target className="h-3.5 w-3.5 text-primary" aria-hidden />
  }
  return <UsersRound className="h-3.5 w-3.5 text-sky-400" aria-hidden />
}

function ActivityThumbnail({ item }: { item: FriendActivityRow }) {
  if (item.activity_type === 'badge' && item.ref_id) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/35 p-0.5">
        <AchievementBadgeArt
          achievementId={item.ref_id}
          alt={item.title ?? 'Badge'}
          className="h-full w-full"
        />
      </div>
    )
  }

  if (item.activity_type === 'pool_join' && item.pool_avatar) {
    return (
      <PoolAvatarImage
        avatar={item.pool_avatar}
        size="sm"
        className="h-9 w-9 rounded-lg border-white/10"
      />
    )
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40">
      <ActivityTypeIcon type={item.activity_type} />
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ''
  const diffMs = Date.now() - at
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function FriendsActivityFeedRow({ item }: { item: FriendActivityRow }) {
  const name = item.actor_name?.trim() || 'PoolCup player'
  const title = item.title?.trim() || null
  const detail = item.detail?.trim() || null

  let headline: string
  if (item.activity_type === 'badge') {
    headline = title ? `earned the ${title} badge` : 'earned a badge'
  } else if (item.activity_type === 'pool_join') {
    headline = title ? `joined ${title}` : 'joined a pool'
  } else {
    headline = title || 'locked in a prediction result'
  }

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/50 px-3 py-3">
      <UserProfileLink
        userId={item.actor_id}
        username={item.actor_username}
        ariaLabel={`${name}'s profile`}
        className="shrink-0"
      >
        <UserAvatarImage
          avatar={resolveAvatarFilename(item.actor_avatar)}
          customAvatarUrl={item.actor_custom_avatar_url}
          className="h-10 w-10"
        />
      </UserProfileLink>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <UserProfileLink
            userId={item.actor_id}
            username={item.actor_username}
            className="font-semibold text-foreground hover:underline"
          >
            {name}
          </UserProfileLink>{' '}
          <span className="text-muted-foreground">{headline}</span>
        </p>
        {detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground/90">{detail}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {formatRelativeTime(item.occurred_at)}
        </p>
      </div>

      <ActivityThumbnail item={item} />
    </li>
  )
}

function FeedSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-3"
        >
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted/60" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 max-w-[14rem] w-[75%] animate-pulse rounded bg-muted/60" />
            <div className="h-2.5 max-w-[8rem] w-1/2 animate-pulse rounded bg-muted/40" />
          </div>
        </li>
      ))}
    </ul>
  )
}

type FriendsActivityFeedProps = {
  className?: string
  onFindFriends?: () => void
}

export function FriendsActivityFeed({
  className,
  onFindFriends,
}: FriendsActivityFeedProps) {
  const [rows, setRows] = useState<FriendActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const trackedLoadRef = useRef(false)

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true)
    else {
      setLoading(true)
      setError(null)
    }

    const result = await getFriendActivityFeed(supabase, PAGE_SIZE, offset)
    if (result.error && result.rows.length === 0 && !append) {
      setRows([])
      setError(result.error)
      setHasMore(false)
      setLoading(false)
      setLoadingMore(false)
      return
    }

    setRows((prev) => (append ? [...prev, ...result.rows] : result.rows))
    setHasMore(result.rows.length >= PAGE_SIZE)
    setError(null)
    setLoading(false)
    setLoadingMore(false)

    if (!trackedLoadRef.current && !append) {
      trackedLoadRef.current = true
      capturePostHog('activity_feed_loaded', {
        count: result.rows.length,
        has_more: result.rows.length >= PAGE_SIZE,
      })
    }
  }, [])

  useEffect(() => {
    void loadPage(0, false)
  }, [loadPage])

  return (
    <section className={cn('mt-8 space-y-3', className)} aria-labelledby="friends-activity-heading">
      <h2
        id="friends-activity-heading"
        className="flex items-center gap-2 font-display text-xl tracking-wide text-foreground"
      >
        <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        Activity
      </h2>

      {loading ? <FeedSkeleton /> : null}

      {!loading && error ? (
        <div className="rounded-xl border border-border/80 bg-card/40 px-4 py-8 text-center">
          <p className="text-sm text-destructive">Couldn’t load activity.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('mt-3', FOCUS_VISIBLE_RING)}
            onClick={() => void loadPage(0, false)}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-card/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No friend activity yet — add friends to see badges, pool joins, and
            locked prediction results here.
          </p>
          {onFindFriends ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('mt-4', FOCUS_VISIBLE_RING)}
              onClick={onFindFriends}
            >
              Find friends
            </Button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <ul className="space-y-2">
            {rows.map((item, index) => (
              <FriendsActivityFeedRow
                key={activityRowKey(item, index)}
                item={item}
              />
            ))}
          </ul>
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingMore}
                className={cn('gap-1.5', FOCUS_VISIBLE_RING)}
                onClick={() => void loadPage(rows.length, true)}
              >
                {loadingMore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                Load more
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
