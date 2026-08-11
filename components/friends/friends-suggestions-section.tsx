'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  friendSuggestionReasonLabel,
  getFriendSuggestions,
  getMutualFriendsCount,
  sendFriendRequest,
  statusAfterSend,
  type FriendSuggestionRow,
} from '@/src/lib/friendships'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'

const SUGGESTION_LIMIT = 8

function SuggestionSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-3"
        >
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted/60" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-muted/60" />
            <div className="h-2.5 w-40 animate-pulse rounded bg-muted/40" />
          </div>
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted/50" />
        </li>
      ))}
    </ul>
  )
}

function MutualFriendsHint({ userId }: { userId: string }) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void getMutualFriendsCount(supabase, userId).then((result) => {
      if (cancelled) return
      setCount(result.count)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (count == null || count <= 0) return null
  return (
    <span className="text-[11px] text-muted-foreground">
      {count} mutual friend{count === 1 ? '' : 's'}
    </span>
  )
}

type FriendsSuggestionsSectionProps = {
  className?: string
  onFriendshipChanged?: () => void
}

export function FriendsSuggestionsSection({
  className,
  onFriendshipChanged,
}: FriendsSuggestionsSectionProps) {
  const [rows, setRows] = useState<FriendSuggestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getFriendSuggestions(supabase, SUGGESTION_LIMIT)
    if (result.error && result.suggestions.length === 0) {
      setRows([])
      setError(result.error)
      setLoading(false)
      return
    }
    setRows(result.suggestions)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAdd(row: FriendSuggestionRow) {
    if (busyId) return
    setBusyId(row.user_id)
    const result = await sendFriendRequest(supabase, row.user_id)
    setBusyId(null)
    if (!result.ok) {
      toast.error('Could not send friend request')
      return
    }
    if (result.result === 'blocked') {
      toast.error('You can’t add this user')
      return
    }
    const mapped = statusAfterSend(result.result)
    if (!mapped) {
      toast.error(
        result.result === 'no_user'
          ? 'User not found'
          : 'Could not send friend request',
      )
      return
    }
    setHiddenIds((prev) => new Set(prev).add(row.user_id))
    capturePostHog('friend_suggestion_added', {
      target_user_id: row.user_id,
      reason: row.reason,
      shared_pools: row.shared_pools,
      shared_sports: row.shared_sports,
    })
    toast.success(
      mapped === 'friends' ? 'You are now friends' : 'Friend request sent',
    )
    onFriendshipChanged?.()
  }

  const visible = rows.filter((row) => !hiddenIds.has(row.user_id))

  // Hide the whole section when empty (no suggestions after load).
  if (!loading && !error && visible.length === 0) {
    return null
  }

  return (
    <section
      className={cn('mt-8 space-y-3', className)}
      aria-labelledby="suggested-friends-heading"
    >
      <div>
        <h2
          id="suggested-friends-heading"
          className="flex items-center gap-2 font-display text-xl tracking-wide text-foreground"
        >
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          Suggested friends
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          People from shared pools and sports you like.
        </p>
      </div>

      {loading ? <SuggestionSkeleton /> : null}

      {!loading && error ? (
        <div className="rounded-xl border border-border/80 bg-card/40 px-4 py-8 text-center">
          <p className="text-sm text-destructive">
            Couldn’t load suggestions.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('mt-3', FOCUS_VISIBLE_RING)}
            onClick={() => void load()}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {!loading && !error && visible.length > 0 ? (
        <ul className="space-y-2">
          {visible.map((row) => {
            const name = row.display_name?.trim() || 'PoolCup player'
            const reason = friendSuggestionReasonLabel(row)
            const busy = busyId === row.user_id
            const shareBits: string[] = []
            if (row.shared_pools > 0) {
              shareBits.push(
                `${row.shared_pools} pool${row.shared_pools === 1 ? '' : 's'}`,
              )
            }
            if (row.shared_sports > 0) {
              shareBits.push(
                `${row.shared_sports} sport${row.shared_sports === 1 ? '' : 's'}`,
              )
            }

            return (
              <li
                key={row.user_id}
                className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/80 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserProfileLink
                      userId={row.user_id}
                      username={row.username}
                      ariaLabel={`${name}'s profile`}
                      className="shrink-0"
                    >
                      <UserAvatarImage
                        avatar={resolveAvatarFilename(row.avatar)}
                        customAvatarUrl={row.custom_avatar_url}
                        className="h-10 w-10"
                      />
                    </UserProfileLink>
                    <div className="min-w-0">
                      <UserProfileLink
                        userId={row.user_id}
                        username={row.username}
                        className="block truncate text-sm font-semibold text-foreground hover:underline"
                      >
                        {name}
                      </UserProfileLink>
                      {row.username ? (
                        <p className="truncate text-[11px] text-muted-foreground">
                          @{row.username}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-primary/90">
                        {reason}
                        {shareBits.length > 0
                          ? ` · ${shareBits.join(' · ')}`
                          : ''}
                      </p>
                      <MutualFriendsHint userId={row.user_id} />
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  className={cn('h-8 shrink-0 gap-1', FOCUS_VISIBLE_RING)}
                  onClick={() => void handleAdd(row)}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Add friend
                </Button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
