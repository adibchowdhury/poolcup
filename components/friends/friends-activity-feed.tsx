'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, Sparkles } from 'lucide-react'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import { Button } from '@/components/ui/button'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import {
  ACHIEVEMENT_RARITY_STYLES,
  achievementRarityLabel,
} from '@/src/lib/achievement-rarity'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  getFriendsActivityFeed,
  type FriendsActivityFeedItem,
} from '@/src/lib/friendships'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 30

function activityItemKey(item: FriendsActivityFeedItem, index: number): string {
  if (item.type === 'badge_earned') {
    return [
      item.type,
      item.user_id,
      item.badge_name ?? '',
      item.ts,
      String(index),
    ].join(':')
  }
  return [item.type, item.user_id, item.pool_id, item.ts, String(index)].join(
    ':',
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

function displayName(username: string | null): string {
  const trimmed = username?.trim()
  return trimmed || 'PoolCup player'
}

function BadgeEarnedCard({ item }: { item: Extract<FriendsActivityFeedItem, { type: 'badge_earned' }> }) {
  const name = displayName(item.username)
  const badgeName = item.badge_name?.trim() || 'a badge'
  const rarityLabel = achievementRarityLabel(item.badge_rarity)
  const rarityStyle = ACHIEVEMENT_RARITY_STYLES[rarityLabel]
  const artId = item.badge_art?.replace(/\.[^.]+$/, '') || 'badge'

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card/50 px-3 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.18)]',
        rarityStyle.border,
      )}
    >
      <UserProfileLink
        userId={item.user_id}
        username={item.username}
        ariaLabel={`${name}'s profile`}
        className="shrink-0"
      >
        <UserAvatarImage
          avatar={resolveAvatarFilename(item.avatar)}
          customAvatarUrl={null}
          className="h-10 w-10"
        />
      </UserProfileLink>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <UserProfileLink
            userId={item.user_id}
            username={item.username}
            className="font-semibold text-foreground hover:underline"
          >
            {name}
          </UserProfileLink>{' '}
          <span className="text-muted-foreground">earned </span>
          <span className={cn('font-medium', rarityStyle.text)}>{badgeName}</span>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              rarityStyle.chip,
            )}
          >
            {rarityLabel}
          </span>
          <span className="text-[11px] text-muted-foreground/70">
            {formatRelativeTime(item.ts)}
          </span>
        </div>
      </div>

      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-black/35 p-0.5',
          rarityStyle.border,
          rarityStyle.glow,
        )}
      >
        <AchievementBadgeArt
          achievementId={artId}
          artFilename={item.badge_art}
          alt={badgeName}
          className="h-full w-full"
        />
      </div>
    </li>
  )
}

function PoolJoinedCard({
  item,
}: {
  item: Extract<FriendsActivityFeedItem, { type: 'pool_joined' }>
}) {
  const name = displayName(item.username)
  const poolName = item.pool_name?.trim() || 'a pool'
  const href = item.pool_invite_code
    ? `/pool/${encodeURIComponent(item.pool_invite_code)}`
    : null

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/50 px-3 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
      <UserProfileLink
        userId={item.user_id}
        username={item.username}
        ariaLabel={`${name}'s profile`}
        className="shrink-0"
      >
        <UserAvatarImage
          avatar={resolveAvatarFilename(item.avatar)}
          customAvatarUrl={null}
          className="h-10 w-10"
        />
      </UserProfileLink>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <UserProfileLink
            userId={item.user_id}
            username={item.username}
            className="font-semibold text-foreground hover:underline"
          >
            {name}
          </UserProfileLink>{' '}
          <span className="text-muted-foreground">joined </span>
          {href ? (
            <Link
              href={href}
              className={cn(
                'font-medium text-foreground hover:underline',
                FOCUS_VISIBLE_RING,
                'rounded-sm',
              )}
            >
              {poolName}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{poolName}</span>
          )}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {formatRelativeTime(item.ts)}
        </p>
      </div>
    </li>
  )
}

function FriendsActivityFeedRow({ item }: { item: FriendsActivityFeedItem }) {
  if (item.type === 'badge_earned') {
    return <BadgeEarnedCard item={item} />
  }
  return <PoolJoinedCard item={item} />
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
          <div className="h-12 w-12 animate-pulse rounded-lg bg-muted/50" />
        </li>
      ))}
    </ul>
  )
}

type FriendsActivityFeedProps = {
  userId: string
  className?: string
  onFindFriends?: () => void
}

export function FriendsActivityFeed({
  userId,
  className,
  onFindFriends,
}: FriendsActivityFeedProps) {
  const [items, setItems] = useState<FriendsActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const viewedRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loadPage = useCallback(
    async (before: string | null, append: boolean) => {
      if (append) setLoadingMore(true)
      else {
        setLoading(true)
        setError(null)
      }

      const result = await getFriendsActivityFeed(supabase, userId, {
        limit: PAGE_SIZE,
        before,
      })

      if (result.error && result.items.length === 0 && !append) {
        setItems([])
        setError(result.error)
        setHasMore(false)
        setLoading(false)
        setLoadingMore(false)
        return
      }

      setItems((prev) => (append ? [...prev, ...result.items] : result.items))
      setHasMore(result.items.length >= PAGE_SIZE)
      setError(null)
      setLoading(false)
      setLoadingMore(false)

      if (!viewedRef.current && !append) {
        viewedRef.current = true
        capturePostHog('friends_activity_viewed', {
          count: result.items.length,
          has_more: result.items.length >= PAGE_SIZE,
        })
      }
    },
    [userId],
  )

  useEffect(() => {
    void loadPage(null, false)
  }, [loadPage])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loading || loadingMore || error) return

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((entry) => entry.isIntersecting)
        if (!hit || items.length === 0) return
        const oldest = items[items.length - 1]?.ts
        if (!oldest) return
        void loadPage(oldest, true)
      },
      { rootMargin: '160px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, error, items, loadPage])

  return (
    <section
      className={cn('space-y-3', className)}
      aria-labelledby="friends-activity-heading"
    >
      <h2 id="friends-activity-heading" className="sr-only">
        Friends activity
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
            onClick={() => void loadPage(null, false)}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-card/40 px-4 py-10 text-center">
          <Sparkles
            className="mx-auto h-8 w-8 text-primary/70"
            aria-hidden
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Add friends to see their activity
          </p>
          {onFindFriends ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('mt-4 gap-1.5', FOCUS_VISIBLE_RING)}
              onClick={onFindFriends}
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              Find friends
            </Button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <ul className="space-y-2">
            {items.map((item, index) => (
              <FriendsActivityFeedRow
                key={activityItemKey(item, index)}
                item={item}
              />
            ))}
          </ul>
          <div ref={sentinelRef} className="h-4" aria-hidden />
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingMore}
                className={cn('gap-1.5', FOCUS_VISIBLE_RING)}
                onClick={() => {
                  const oldest = items[items.length - 1]?.ts
                  if (!oldest) return
                  void loadPage(oldest, true)
                }}
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
