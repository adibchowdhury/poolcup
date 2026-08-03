'use client'

import Link from 'next/link'
import { AchievementBadgeArt } from '@/components/achievements/achievement-badge-art'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'

export type FriendsActivityKind =
  | 'badge_earned'
  | 'pool_joined'
  | 'level_reached'

export type FriendsActivityItem = {
  id: string
  kind: FriendsActivityKind
  /** ISO timestamp used for Today / Yesterday / This Week grouping. */
  occurredAt: string
  userId: string
  displayName: string
  avatar: string
  /** badge_earned */
  badgeName?: string
  badgeAchievementId?: string
  /** pool_joined */
  poolName?: string
  /** Absolute or public path for pool crest thumbnail. */
  poolImageSrc?: string | null
  /** level_reached */
  level?: number
}

type ActivityGroupLabel = 'Today' | 'Yesterday' | 'This Week'

/** Max rows shown per date group (favor recent activity). */
const ACTIVITY_GROUP_LIMITS: Record<ActivityGroupLabel, number> = {
  Today: 3,
  Yesterday: 2,
  'This Week': 1,
}

type ActivityGroup = {
  label: ActivityGroupLabel
  items: FriendsActivityItem[]
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function daysAgo(days: number, hour = 14): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, 20, 0, 0)
  return d.toISOString()
}

/**
 * TEMPORARY — replace with real friend activity RPC
 * (friends' badge earns + pool joins + level-ups).
 * Design-scaffolding mock only; do not ship as product data.
 */
const MOCK_FRIENDS_ACTIVITY: FriendsActivityItem[] = [
  {
    id: 'mock-today-1',
    kind: 'badge_earned',
    occurredAt: hoursAgo(1.5),
    userId: '00000000-0000-4000-8000-000000000001',
    displayName: 'Michael Wu',
    avatar: 'goal_keeper.png',
    badgeName: 'Sharpshooter',
    badgeAchievementId: 'picture_perfect',
  },
  {
    id: 'mock-today-2',
    kind: 'pool_joined',
    occurredAt: hoursAgo(4),
    userId: '00000000-0000-4000-8000-000000000002',
    displayName: 'Jessica',
    avatar: 'cheerleader.png',
    poolName: 'Champions League Official',
    poolImageSrc: '/avatars/goal_keeper_red.png',
  },
  {
    id: 'mock-today-3',
    kind: 'level_reached',
    occurredAt: hoursAgo(6),
    userId: '00000000-0000-4000-8000-000000000003',
    displayName: 'Priya Patel',
    avatar: 'white_skin_avatar_girl.png',
    level: 7,
  },
  {
    id: 'mock-yesterday-1',
    kind: 'badge_earned',
    occurredAt: daysAgo(1, 19),
    userId: '00000000-0000-4000-8000-000000000004',
    displayName: 'Marcus Cole',
    avatar: 'brown_skin_avatar.png',
    badgeName: 'Welcome Aboard',
    badgeAchievementId: 'welcome_aboard',
  },
  {
    id: 'mock-yesterday-2',
    kind: 'pool_joined',
    occurredAt: daysAgo(1, 11),
    userId: '00000000-0000-4000-8000-000000000005',
    displayName: 'Elena Rossi',
    avatar: 'white_skin_avatar.png',
    poolName: 'Office World Cup',
    poolImageSrc: '/avatars/goal_keeper.png',
  },
  {
    id: 'mock-week-1',
    kind: 'level_reached',
    occurredAt: daysAgo(3, 16),
    userId: '00000000-0000-4000-8000-000000000006',
    displayName: 'Diego Alvarez',
    avatar: 'goal_keeper_red.png',
    level: 4,
  },
  {
    id: 'mock-week-2',
    kind: 'badge_earned',
    occurredAt: daysAgo(4, 10),
    userId: '00000000-0000-4000-8000-000000000001',
    displayName: 'Michael Wu',
    avatar: 'goal_keeper.png',
    badgeName: 'First Steps',
    badgeAchievementId: 'first_steps',
  },
  {
    id: 'mock-week-3',
    kind: 'pool_joined',
    occurredAt: daysAgo(5, 20),
    userId: '00000000-0000-4000-8000-000000000002',
    displayName: 'Jessica',
    avatar: 'cheerleader.png',
    poolName: 'World Cup 2026 Predictions',
    poolImageSrc: '/avatars/cheerleader.png',
  },
]

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function activityActionText(item: FriendsActivityItem): string {
  if (item.kind === 'badge_earned') {
    return `earned the ${item.badgeName ?? 'achievement'} badge`
  }
  if (item.kind === 'pool_joined') {
    return `joined ${item.poolName ?? 'a pool'}`
  }
  return `reached Level ${item.level ?? '?'}`
}

function groupFriendsActivity(
  items: FriendsActivityItem[],
  now = new Date(),
): ActivityGroup[] {
  const todayStart = startOfLocalDay(now)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)

  const buckets: Record<ActivityGroupLabel, FriendsActivityItem[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
  }

  const sorted = [...items].sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  )

  for (const item of sorted) {
    const at = new Date(item.occurredAt)
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

function ActivityThumbnail({ item }: { item: FriendsActivityItem }) {
  if (item.kind === 'badge_earned' && item.badgeAchievementId) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/35 p-0.5">
        <AchievementBadgeArt
          achievementId={item.badgeAchievementId}
          alt={item.badgeName ?? 'Badge'}
          className="h-full w-full"
        />
      </div>
    )
  }

  if (item.kind === 'pool_joined' && item.poolImageSrc) {
    return (
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/35">
        {/* eslint-disable-next-line @next/next/no-img-element -- mock public asset */}
        <img
          src={item.poolImageSrc}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return null
}

function FriendsActivityRow({ item }: { item: FriendsActivityItem }) {
  const action = activityActionText(item)

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <UserProfileLink
        userId={item.userId}
        ariaLabel={`${item.displayName}'s profile`}
        className="shrink-0"
      >
        <UserAvatarImage
          avatar={item.avatar}
          className="h-9 w-9"
          imgClassName="object-contain object-bottom p-0.5"
        />
      </UserProfileLink>

      <p className="min-w-0 flex-1 truncate text-sm leading-snug">
        <UserProfileLink
          userId={item.userId}
          className="font-semibold text-foreground hover:underline"
        >
          {item.displayName}
        </UserProfileLink>{' '}
        <span className="font-normal text-muted-foreground">{action}</span>
      </p>

      <ActivityThumbnail item={item} />
    </li>
  )
}

/**
 * Dashboard feed: Friends Activity.
 * Currently driven by MOCK_FRIENDS_ACTIVITY — swap for real RPC next.
 */
export function FriendsActivitySection() {
  const groups = groupFriendsActivity(MOCK_FRIENDS_ACTIVITY)

  return (
    <DashboardFeedSection
      id="friends-activity"
      title="Friends Activity"
      action={
        <Link
          href="/friends"
          className="text-xs font-medium text-primary hover:underline"
        >
          Friends
        </Link>
      }
    >
      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No friend activity yet.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label} className="space-y-2">
              <h3 className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                {group.label}
              </h3>
              <ul className="divide-y divide-white/[0.05]">
                {group.items.map((item) => (
                  <FriendsActivityRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </DashboardFeedSection>
  )
}

/** Exported for the upcoming real-data swap / tests. */
export { MOCK_FRIENDS_ACTIVITY, groupFriendsActivity }
