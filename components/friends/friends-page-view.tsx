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
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { FriendsActivityFeed } from '@/components/friends/friends-activity-feed'
import {
  FriendsFindSearch,
  type FriendsFindSearchHandle,
} from '@/components/friends/friends-find-search'
import { FriendsSuggestionsSection } from '@/components/friends/friends-suggestions-section'
import { FriendsXpLeaderboard } from '@/components/friends/friends-xp-leaderboard'
import {
  MutedBadge,
  UserModerationMenu,
} from '@/components/friends/user-moderation-menu'
import { useAuth } from '@/src/lib/auth-context'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  acceptFriendRequest,
  getFriendsLeaderboard,
  getIncomingFriendRequests,
  getMutualFriendsCount,
  getMyFriends,
  listMutedUserIds,
  removeFriend,
  type FriendRow,
  type FriendsLeaderboardRow,
  type IncomingFriendRequestRow,
} from '@/src/lib/friendships'
import { capturePostHog } from '@/src/lib/posthog-client'
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
  muted,
  mutualCount,
}: {
  userId: string
  displayName: string
  avatar: string | null
  customAvatarUrl: string | null
  muted?: boolean
  mutualCount?: number | null
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
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <UserProfileLink
            userId={userId}
            className="min-w-0 truncate text-sm font-semibold text-foreground hover:underline"
          >
            {displayName}
          </UserProfileLink>
          {muted ? <MutedBadge /> : null}
        </div>
        {mutualCount != null && mutualCount > 0 ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function FriendListSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-3"
        >
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted/60" />
          <div className="h-3 w-28 animate-pulse rounded bg-muted/60" />
        </li>
      ))}
    </ul>
  )
}

function MutualCountLoader({
  userId,
  onLoaded,
}: {
  userId: string
  onLoaded: (userId: string, count: number) => void
}) {
  useEffect(() => {
    let cancelled = false
    void getMutualFriendsCount(supabase, userId).then((result) => {
      if (cancelled) return
      onLoaded(userId, result.count)
    })
    return () => {
      cancelled = true
    }
  }, [userId, onLoaded])
  return null
}

export function FriendsPageView() {
  const { user, loading: authLoading } = useAuth()
  const { adjustCount, refresh: refreshRequestCount } = useFriendRequestCount()
  const findSearchRef = useRef<FriendsFindSearchHandle>(null)
  const viewedRef = useRef(false)
  const [friends, setFriends] = useState<FriendRow[]>([])
  const [incoming, setIncoming] = useState<IncomingFriendRequestRow[]>([])
  const [leaderboard, setLeaderboard] = useState<FriendsLeaderboardRow[]>([])
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set())
  const [mutualById, setMutualById] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const onMutualLoaded = useCallback((userId: string, count: number) => {
    setMutualById((prev) =>
      prev[userId] === count ? prev : { ...prev, [userId]: count },
    )
  }, [])

  const reload = useCallback(async () => {
    if (!user?.id) {
      setFriends([])
      setIncoming([])
      setLeaderboard([])
      setMutedIds(new Set())
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const [nextFriends, nextIncoming, nextBoard, muted] = await Promise.all([
      getMyFriends(supabase),
      getIncomingFriendRequests(supabase),
      getFriendsLeaderboard(supabase),
      listMutedUserIds(supabase),
    ])
    if (nextFriends.error && nextFriends.friends.length === 0) {
      setFriends([])
      setIncoming([])
      setLeaderboard([])
      setError(nextFriends.error)
      setLoading(false)
      return
    }
    setFriends(nextFriends.friends)
    setIncoming(nextIncoming.requests)
    setLeaderboard(nextBoard)
    setMutedIds(muted)
    setError(null)
    setLoading(false)
    void refreshRequestCount()
  }, [user?.id, refreshRequestCount])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useEffect(() => {
    if (loading || error || !user || viewedRef.current) return
    viewedRef.current = true
    capturePostHog('friends_viewed', {
      friend_count: friends.length,
      request_count: incoming.length,
    })
  }, [loading, error, user, friends.length, incoming.length])

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

  if (authLoading) {
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
        <Button asChild className={cn('mt-4', FOCUS_VISIBLE_RING)}>
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

      {error ? (
        <div className="mt-8 rounded-xl border border-border/80 bg-card/40 px-4 py-10 text-center">
          <p className="text-sm text-destructive">Couldn’t load friends.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('mt-3', FOCUS_VISIBLE_RING)}
            onClick={() => void reload()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <FriendsFindSearch
            ref={findSearchRef}
            onFriendshipChanged={() => void reload()}
          />

          {loading ? (
            <section className="mt-8 space-y-3">
              <h2 className="font-display text-xl tracking-wide text-foreground">
                Your friends
              </h2>
              <FriendListSkeleton />
            </section>
          ) : (
            <>
              {incoming.length > 0 ? (
                <section className="mt-6 space-y-3 rounded-2xl border border-primary/35 bg-primary/[0.07] p-4 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_8%,transparent)_inset]">
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
                        Accept or decline — they&apos;ll see Friends once you
                        accept.
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
                              className={cn('h-8 gap-1', FOCUS_VISIBLE_RING)}
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
                              className={cn(
                                'h-8 text-muted-foreground',
                                FOCUS_VISIBLE_RING,
                              )}
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

              <FriendsSuggestionsSection
                onFriendshipChanged={() => void reload()}
              />

              <FriendsXpLeaderboard
                rows={leaderboard}
                solo={friends.length === 0}
              />

              <FriendsActivityFeed onFindFriends={focusFindSearch} />

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
                      No friends yet — search by username or name, or open a
                      player&apos;s profile and tap Add friend.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn('mt-4 gap-1.5', FOCUS_VISIBLE_RING)}
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
                      const muted = mutedIds.has(row.user_id)
                      return (
                        <li
                          key={row.user_id}
                          className="flex items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-3 py-3"
                        >
                          <MutualCountLoader
                            userId={row.user_id}
                            onLoaded={onMutualLoaded}
                          />
                          <div className="min-w-0 flex-1">
                            <FriendIdentity
                              userId={row.user_id}
                              displayName={name}
                              avatar={row.avatar}
                              customAvatarUrl={row.custom_avatar_url}
                              muted={muted}
                              mutualCount={mutualById[row.user_id] ?? null}
                            />
                          </div>
                          <UserModerationMenu
                            targetUserId={row.user_id}
                            onMutedChange={(next) => {
                              setMutedIds((prev) => {
                                const copy = new Set(prev)
                                if (next) copy.add(row.user_id)
                                else copy.delete(row.user_id)
                                return copy
                              })
                            }}
                            onBlocked={() => {
                              setFriends((rows) =>
                                rows.filter((f) => f.user_id !== row.user_id),
                              )
                              setLeaderboard((rows) =>
                                rows.filter((f) => f.user_id !== row.user_id),
                              )
                            }}
                            extraItems={
                              <DropdownMenuItem
                                disabled={busy}
                                className="text-destructive focus:text-destructive"
                                onSelect={() =>
                                  void handleRemoveFriend(row.user_id)
                                }
                              >
                                <UserMinus className="h-4 w-4" aria-hidden />
                                Remove friend
                              </DropdownMenuItem>
                            }
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  )
}

function Header({ onFindFriends }: { onFindFriends?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/dashboard?tab=dashboard"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground',
          FOCUS_VISIBLE_RING,
        )}
        aria-label="Back to dashboard"
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
          className={cn('h-8 shrink-0 gap-1.5', FOCUS_VISIBLE_RING)}
          onClick={onFindFriends}
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          Find friends
        </Button>
      ) : null}
    </div>
  )
}
