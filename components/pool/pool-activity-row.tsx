'use client'

import Image from 'next/image'
import { formatRelativeTimestamp } from '@/src/lib/points-transaction-feed'
import { getAvatarSrc } from '@/src/lib/avatars'
import {
  getPoolActivityMessage,
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

export function PoolActivityRow({ activity, currentUserId }: PoolActivityRowProps) {
  const { actor, action } = getPoolActivityMessage(activity, currentUserId)

  return (
    <article
      data-activity-id={activity.id}
      className="flex min-w-0 items-start gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3"
    >
      <ActivityAvatar displayName={activity.displayName} avatar={activity.avatar} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="font-semibold">{actor}</span>{' '}
          <span className="text-muted-foreground">{action}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>
          {formatRelativeTimestamp(activity.createdAt)}
        </p>
      </div>
    </article>
  )
}
