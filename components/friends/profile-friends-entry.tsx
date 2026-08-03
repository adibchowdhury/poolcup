'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFriendRequestCount } from '@/hooks/use-friend-request-count'
import { getMyFriends } from '@/src/lib/friendships'
import { supabase } from '@/src/lib/supabase'

type ProfileFriendsEntryProps = {
  active: boolean
  className?: string
}

/**
 * Self-profile entry to /friends with friend count + incoming request badge
 * (badge count comes from the app-wide FriendRequestCountProvider).
 */
export function ProfileFriendsEntry({
  active,
  className,
}: ProfileFriendsEntryProps) {
  const { count: incomingCount } = useFriendRequestCount()
  const [friendCount, setFriendCount] = useState<number | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false

    void getMyFriends(supabase).then((friends) => {
      if (cancelled) return
      setFriendCount(friends.length)
    })

    return () => {
      cancelled = true
    }
  }, [active])

  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={cn(
        'relative h-8 gap-1.5',
        incomingCount > 0 && 'border-primary/40 bg-primary/10',
        className,
      )}
    >
      <Link href="/friends">
        <Users className="h-3.5 w-3.5" aria-hidden />
        Friends
        {friendCount != null ? (
          <span className="tabular-nums text-muted-foreground">
            ({friendCount})
          </span>
        ) : null}
        {incomingCount > 0 ? (
          <span
            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground"
            aria-label={`${incomingCount} friend requests`}
          >
            {incomingCount > 9 ? '9+' : incomingCount}
          </span>
        ) : null}
      </Link>
    </Button>
  )
}
