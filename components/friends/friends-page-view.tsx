'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Search,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import {
  FriendsFindSearch,
  type FriendsFindSearchHandle,
} from '@/components/friends/friends-find-search'
import { FriendsXpLeaderboard } from '@/components/friends/friends-xp-leaderboard'
import { useAuth } from '@/src/lib/auth-context'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import {
  acceptFriendRequest,
  getFriendsLeaderboard,
  getIncomingFriendRequests,
  getMyFriends,
  removeFriend,
  type FriendRow,
  type FriendsLeaderboardRow,
  type IncomingFriendRequestRow,
} from '@/src/lib/friendships'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import {
  emitFriendRequestsChanged,
  useFriendRequestCount,
} from '@/hooks/use-friend-request-count'

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
  const { adjustCount, refresh: refreshRequestCount } = useFriendRequestCount()
  const findSearchRef = useRef<FriendsFindSearchHandle>(null)
  const [friends, setFriends] = useState<FriendRow[]>([])
  const [incoming, setIncoming] = useState<IncomingFriendRequestRow[]>([])
  const [leaderboard, setLeaderboard] = useState<FriendsLeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setFriends([])
      setIncoming([])
      setLeaderboard([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [nextFriends, nextIncoming, nextBoard] = await Promise.all([
      getMyFriends(supabase),
      getIncomingFriendRequests(supabase),
      getFriendsLeaderboard(supabase),
    ])
    setFriends(nextFriends)
    setIncoming(nextIncoming)
    setLeaderboard(nextBoard)
    setLoading(false)
    void refreshRequestCount()
  }, [user?.id, refreshRequestCount])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  // Deep-link /friends#find (or header Find friends) focuses the search input.
  useEffect(() => {
    if (loading || !user) return
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#find') return
    findSearchRef.current?.focus()
  }, [loading, user])

  function focusFindSearch() {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#find')
    }
    findSearchRef.current?.focus()
  }

  async function handleAccept(requesterId: string) {
    setBusyId(requesterId)
    const previous = incoming
    setIncoming((rows) => rows.filter((row) => row.user_id !== requesterId))
    adjustCount(-1)
    const result = await acceptFriendRequest(supabase, requesterId)
    setBusyId(null)
    if (!result.ok || result.result !== 'accepted') {
      setIncoming(previous)
      adjustCount(1)
      toast.error('Could not accept request')
      return
    }
    toast.success('Friend request accepted')
    emitFriendRequestsChanged()
    void reload()
  }

  async function handleDecline(requesterId: string) {
    setBusyId(requesterId)
    const previous = incoming
    setIncoming((rows) => rows.filter((row) => row.user_id !== requesterId))
    adjustCount(-1)
    const result = await removeFriend(supabase, requesterId)
    setBusyId(null)
    if (!result.ok) {
      setIncoming(previous)
      adjustCount(1)
      toast.error('Could not decline request')
      return
    }
    toast.success('Request declined')
    emitFriendRequestsChanged()
  }

  async function handleRemoveFriend(otherId: string) {
    setBusyId(otherId)
    const previous = friends
    const previousBoard = leaderboard
    setFriends((rows) => rows.filter((row) => row.user_id !== otherId))
    setLeaderboard((rows) => rows.filter((row) => row.user_id !== otherId))
    const result = await removeFriend(supabase, otherId)
    setBusyId(null)
    if (!result.ok) {
      setFriends(previous)
      setLeaderboard(previousBoard)
      toast.error('Could not remove friend')
      return
    }
    toast.success('Friend removed')
    void getFriendsLeaderboard(supabase).then(setLeaderboard)
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
      <Header onFindFriends={focusFindSearch} />

      <FriendsFindSearch
        ref={findSearchRef}
        onFriendshipChanged={() => void reload()}
      />

      {incoming.length > 0 ? (
        <section className="mt-6 space-y-3 rounded-2xl border border-primary/35 bg-primary/[0.07] p-4 shadow-[0_0_0_1px_rgba(0,230,118,0.08)_inset]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Needs your attention
              </p>
              <h2 className="mt-1 font-display text-xl tracking-wide text-foreground">
                Friend requests
                <span className="ml-2 text-sm text-muted-foreground">
                  ({incoming.length})
                </span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Accept or decline — they&apos;ll see Friends once you accept.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {incoming.map((row) => {
              const name = row.display_name?.trim() || 'PoolCup player'
              const busy = busyId === row.user_id
              return (
                <li
                  key={row.user_id}
                  className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/70 px-3 py-3"
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

      <FriendsXpLeaderboard rows={leaderboard} solo={friends.length === 0} />

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
              No friends yet — search above or open a player&apos;s profile and
              tap Add friend.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={focusFindSearch}
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              Find friends
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

function Header({ onFindFriends }: { onFindFriends?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/dashboard?tab=profile"
        className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Back to profile"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </Link>
      <h1 className="min-w-0 flex-1 font-display text-3xl tracking-wide text-foreground">
        Friends
      </h1>
      {onFindFriends ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 gap-1.5"
          onClick={onFindFriends}
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          Find friends
        </Button>
      ) : null}
    </div>
  )
}
