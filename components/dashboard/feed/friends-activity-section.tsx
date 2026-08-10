'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import {
  getFriendActivity,
  type FriendActivityRow,
} from '@/src/lib/friendships'
import { supabase } from '@/src/lib/supabase'

type ActivityGroupLabel = 'Today' | 'Yesterday' | 'This Week'

/** Max rows shown per date group (favor recent activity). */
const ACTIVITY_GROUP_LIMITS: Record<ActivityGroupLabel, number> = {
  Today: 3,
  Yesterday: 2,
  'This Week': 1,
}

const FETCH_LIMIT = 30

type ActivityGroup = {
  label: ActivityGroupLabel
  items: FriendActivityRow[]
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function activityActionText(item: FriendActivityRow): string {
  if (item.activity_type === 'badge') {
    return `earned the ${item.title?.trim() || 'achievement'} badge`
  }
  return `joined ${item.title?.trim() || 'a pool'}`
}

function activityRowKey(item: FriendActivityRow, index: number): string {
  return [
    item.activity_type,
    item.actor_id,
    item.ref_id ?? '',
    item.occurred_at,
    String(index),
  ].join(':')
}

/**
 * Group by calendar day buckets, newest first within each, then cap.
 * Today = same day; Yesterday = previous day; This Week = last 7 days before yesterday.
 */
export function groupFriendActivity(
  items: FriendActivityRow[],
  now = new Date(),
): ActivityGroup[] {
  const todayStart = startOfLocalDay(now)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)

  const buckets: Record<ActivityGroupLabel, FriendActivityRow[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
  }

  const sorted = [...items].sort(
    (a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
  )

  for (const item of sorted) {
    const at = new Date(item.occurred_at)
    if (Number.isNaN(at.getTime())) continue
    if (at >= todayStart) {
      buckets.Today.push(item)
    } else if (at >= yesterdayStart) {
      buckets.Yesterday.push(item)
    } else if (at >= weekStart) {
      buckets['This Week'].push(item)
    }
  }

  const order: ActivityGroupLabel[] = ['Today', 'Yesterday', 'This Week']
  return order
    .map((label) => ({
      label,
      items: buckets[label].slice(0, ACTIVITY_GROUP_LIMITS[label]),
    }))
    .filter((group) => group.items.length > 0)
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

  return null
}

function FriendsActivityRow({ item }: { item: FriendActivityRow }) {
  const name = item.actor_name?.trim() || 'PoolCup player'
  const action = activityActionText(item)

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <UserProfileLink
        userId={item.actor_id}
        ariaLabel={`${name}'s profile`}
        className="shrink-0"
      >
        <UserAvatarImage
          avatar={item.actor_avatar}
          customAvatarUrl={item.actor_custom_avatar_url}
          className="h-9 w-9"
          imgClassName={
            item.actor_custom_avatar_url
              ? 'object-cover'
              : 'object-contain object-bottom p-0.5'
          }
        />
      </UserProfileLink>

      <p className="min-w-0 flex-1 truncate text-sm leading-snug">
        <UserProfileLink
          userId={item.actor_id}
          className="rounded-sm font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {name}
        </UserProfileLink>{' '}
        <span className="font-normal text-muted-foreground">{action}</span>
      </p>

      <ActivityThumbnail item={item} />
    </li>
  )
}

/** Dashboard feed: accepted friends' badge earns + pool joins. */
export function FriendsActivitySection() {
  const [rows, setRows] = useState<FriendActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void getFriendActivity(supabase, FETCH_LIMIT).then((next) => {
      if (cancelled) return
      setRows(next)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(() => groupFriendActivity(rows), [rows])

  return (
    <DashboardFeedSection
      id="friends-activity"
      title="Friends Activity"
      action={
        <Link
          href="/friends"
          className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Friends
        </Link>
      }
    >
      {loading ? (
        <div
          className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
          aria-label="Loading friend activity"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          Loading…
        </div>
      ) : groups.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No friend activity yet. Add friends to see what they&apos;re up to.
          </p>
          <Link
            href="/friends#find"
            className="mt-2 inline-block rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            Find friends
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label} className="space-y-2">
              <h3 className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                {group.label}
              </h3>
              <ul className="divide-y divide-white/[0.05]">
                {group.items.map((item, index) => (
                  <FriendsActivityRow
                    key={activityRowKey(item, index)}
                    item={item}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </DashboardFeedSection>
  )
}
