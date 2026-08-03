'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { useAuth } from '@/src/lib/auth-context'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import {
  acceptFriendRequest,
  getIncomingFriendRequests,
  getMyFriends,
  removeFriend,
  type FriendRow,
  type IncomingFriendRequestRow,
} from '@/src/lib/friendships'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

function FriendIdentity({
  userId,
  displayName,
  avatar,
  customAvatarUrl,
}: {
  userId: string
  displayName: string
  avatar: string | null
  customAvatarUrl: string | null
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserProfileLink
        userId={userId}
        ariaLabel={`${displayName}'s profile`}
        className="shrink-0"
      >
        <UserAvatarImage
          avatar={resolveAvatarFilename(avatar)}
          customAvatarUrl={customAvatarUrl}
          className="h-10 w-10"
        />
      </UserProfileLink>
      <UserProfileLink
        userId={userId}
        className="min-w-0 truncate text-sm font-semibold text-foreground hover:underline"
      >
        {displayName}
      </UserProfileLink>
    </div>
  )
}

export function FriendsPageView() {
  const { user, loading: authLoading } = useAuth()
  const [friends, setFriends] = useState<FriendRow[]>([])
  const [incoming, setIncoming] = useState<IncomingFriendRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setFriends([])
      setIncoming([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [nextFriends, nextIncoming] = await Promise.all([
      getMyFriends(supabase),
      getIncomingFriendRequests(supabase),
    ])
    setFriends(nextFriends)
    setIncoming(nextIncoming)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  async function handleAccept(requesterId: string) {
    setBusyId(requesterId)
    const previous = incoming
    setIncoming((rows) => rows.filter((row) => row.user_id !== requesterId))
    const result = await acceptFriendRequest(supabase, requesterId)
    setBusyId(null)
    if (!result.ok || result.result !== 'accepted') {
      setIncoming(previous)
      toast.error('Could not accept request')
      return
    }
    toast.success('Friend request accepted')
    void reload()
  }

  async function handleDecline(requesterId: string) {
    setBusyId(requesterId)
    const previous = incoming
    setIncoming((rows) => rows.filter((row) => row.user_id !== requesterId))
    const result = await removeFriend(supabase, requesterId)
    setBusyId(null)
    if (!result.ok) {
      setIncoming(previous)
      toast.error('Could not decline request')
      return
    }
    toast.success('Request declined')
  }

  async function handleRemoveFriend(otherId: string) {
    setBusyId(otherId)
    const previous = friends
    setFriends((rows) => rows.filter((row) => row.user_id !== otherId))
    const result = await removeFriend(supabase, otherId)
    setBusyId(null)
    if (!result.ok) {
      setFriends(previous)
      toast.error('Could not remove friend')
      return
    }
    toast.success('Friend removed')
  }

  if (authLoading || (user && loading)) {
    return (
      <main
        className={cn(
          'mx-auto flex min-h-[70vh] w-full max-w-lg items-center justify-center px-4',
          MOBILE_BOTTOM_NAV_PAD_CLASS,
        )}
      >
        <Loader2
          className="h-8 w-8 animate-spin text-primary"
          aria-label="Loading friends"
        />
      </main>
    )
  }

  if (!user) {
    return (
      <main
        className={cn(
          'mx-auto min-h-[70vh] w-full max-w-lg px-4 py-8',
          MOBILE_BOTTOM_NAV_PAD_CLASS,
        )}
      >
        <Header />
        <p className="mt-6 text-sm text-muted-foreground">
          Sign in to manage friends.
        </p>
        <Button asChild className="mt-4">
          <Link href="/login?next=%2Ffriends">Sign in</Link>
        </Button>
      </main>
    )
  }

  return (
    <main
      className={cn(
        'mx-auto min-h-screen w-full max-w-lg px-4 py-6 sm:py-8',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <Header />

      {incoming.length > 0 ? (
        <section className="mt-8 space-y-3">
          <h2 className="font-display text-xl tracking-wide text-foreground">
            Friend requests
            <span className="ml-2 text-sm text-muted-foreground">
              ({incoming.length})
            </span>
          </h2>
          <ul className="space-y-2">
            {incoming.map((row) => {
              const name = row.display_name?.trim() || 'PoolCup player'
              const busy = busyId === row.user_id
              return (
                <li
                  key={row.user_id}
                  className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/80 px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <FriendIdentity
                      userId={row.user_id}
                      displayName={name}
                      avatar={row.avatar}
                      customAvatarUrl={row.custom_avatar_url}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      className="h-8 gap-1"
                      onClick={() => void handleAccept(row.user_id)}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Accept
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      className="h-8 text-muted-foreground"
                      onClick={() => void handleDecline(row.user_id)}
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className="mt-8 space-y-3">
        <h2 className="flex items-center gap-2 font-display text-xl tracking-wide text-foreground">
          <Users className="h-5 w-5 text-primary" aria-hidden />
          Your friends
          <span className="text-sm text-muted-foreground">
            ({friends.length})
          </span>
        </h2>

        {friends.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-card/40 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No friends yet — add friends from their profile.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {friends.map((row) => {
              const name = row.display_name?.trim() || 'PoolCup player'
              const busy = busyId === row.user_id
              return (
                <li
                  key={row.user_id}
                  className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/80 px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <FriendIdentity
                      userId={row.user_id}
                      displayName={name}
                      avatar={row.avatar}
                      customAvatarUrl={row.custom_avatar_url}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    className="h-8 gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => void handleRemoveFriend(row.user_id)}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserMinus className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Remove
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/dashboard?tab=profile"
        className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Back to profile"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </Link>
      <h1 className="font-display text-3xl tracking-wide text-foreground">
        Friends
      </h1>
    </div>
  )
}
