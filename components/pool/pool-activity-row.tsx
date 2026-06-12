'use client'

import Image from 'next/image'
import { formatRelativeTimestamp } from '@/src/lib/points-transaction-feed'
import { getAvatarSrc } from '@/src/lib/avatars'
import { cn } from '@/lib/utils'
import {
  getPoolActivityMessage,
  getPoolActivityPointsEarnedMessage,
  type PoolActivityFeedItem,
} from '@/src/lib/pool-activity-feed'

type PoolActivityRowProps = {
  activity: PoolActivityFeedItem
  currentUserId: string
}

function ActivityAvatar({
  displayName,
  avatar,
}: {
  displayName: string
  avatar: string | null
}) {
  const initial = displayName.charAt(0).toUpperCase() || '?'

  if (avatar) {
    return (
      <Image
        src={getAvatarSrc(avatar)}
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-full border border-border/80 object-cover object-top"
      />
    )
  }

  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted font-medium text-muted-foreground"
      aria-hidden
    >
      {initial}
    </div>
  )
}

function PointsEarnedActivityBody({
  activity,
  currentUserId,
}: {
  activity: PoolActivityFeedItem
  currentUserId: string
}) {
  const { actor, points, reasonLabel, context } =
    getPoolActivityPointsEarnedMessage(activity, currentUserId)

  return (
    <p className="text-sm text-foreground">
      <span className="font-semibold">{actor}</span>
      <span className="text-muted-foreground"> earned </span>
      <span
        className={cn(
          'mx-0.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5',
          'font-mono text-xs font-semibold tabular-nums text-primary',
        )}
      >
        +{points}
      </span>
      <span className="text-muted-foreground">
        {' '}
        — {reasonLabel} on {context}.
      </span>
    </p>
  )
}

function PredictionActivityBody({
  activity,
  currentUserId,
}: {
  activity: PoolActivityFeedItem
  currentUserId: string
}) {
  const { actor, action } = getPoolActivityMessage(activity, currentUserId)

  return (
    <p className="text-sm text-foreground">
      <span className="font-semibold">{actor}</span>{' '}
      <span className="text-muted-foreground">{action}</span>
    </p>
  )
}

export function PoolActivityRow({ activity, currentUserId }: PoolActivityRowProps) {
  return (
    <article
      data-activity-id={activity.id}
      className="flex min-w-0 items-start gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3"
    >
      <ActivityAvatar displayName={activity.displayName} avatar={activity.avatar} />
      <div className="min-w-0 flex-1">
        {activity.type === 'points_earned' ? (
          <PointsEarnedActivityBody
            activity={activity}
            currentUserId={currentUserId}
          />
        ) : (
          <PredictionActivityBody
            activity={activity}
            currentUserId={currentUserId}
          />
        )}
        <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>
          {formatRelativeTimestamp(activity.createdAt)}
        </p>
      </div>
    </article>
  )
}
