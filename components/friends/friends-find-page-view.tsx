'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DashboardAppShell } from '@/components/dashboard/dashboard-app-shell'
import {
  FriendsFindSearch,
  type FriendsFindSearchHandle,
} from '@/components/friends/friends-find-search'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import { cn } from '@/lib/utils'

export type FriendsFindPageViewProps = {
  userId: string
  email: string
  displayName?: string | null
  avatar?: string | null
  customAvatarUrl?: string | null
}

export function FriendsFindPageView({
  userId,
  email,
  displayName,
  avatar,
  customAvatarUrl,
}: FriendsFindPageViewProps) {
  const findRef = useRef<FriendsFindSearchHandle>(null)
  const openedRef = useRef(false)

  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    capturePostHog('friends_find_opened', { source: 'find_page' })
  }, [])

  return (
    <DashboardAppShell
      userId={userId}
      email={email}
      displayName={displayName}
      avatar={avatar}
      customAvatarUrl={customAvatarUrl}
      hubActiveNav="friends"
      mainClassName="max-w-lg"
    >
      <div className="flex items-center gap-2">
        <Link
          href="/friends?tab=friends"
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground',
            FOCUS_VISIBLE_RING,
          )}
          aria-label="Back to friends"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 font-display text-3xl tracking-wide text-foreground">
          Find friends
        </h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Search by username or display name to send a request.
      </p>

      <FriendsFindSearch
        ref={findRef}
        autoFocus
        hideHeading
        className="mt-6"
      />
    </DashboardAppShell>
  )
}
