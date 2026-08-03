'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  Check,
  Loader2,
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import {
  acceptFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  statusAfterSend,
  type FriendshipStatus,
  type UserSearchRow,
} from '@/src/lib/friendships'
import { emitFriendRequestsChanged } from '@/hooks/use-friend-request-count'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_CHARS = 2

export type FriendsFindSearchHandle = {
  focus: () => void
}

type FriendsFindSearchProps = {
  /** Called after add/accept so lists/leaderboard can refresh. */
  onFriendshipChanged?: () => void
  className?: string
}

type SearchStatus = Exclude<FriendshipStatus, 'self'>

export const FriendsFindSearch = forwardRef<
  FriendsFindSearchHandle,
  FriendsFindSearchProps
>(function FriendsFindSearch({ onFriendshipChanged, className }, ref) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const requestSeqRef = useRef(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchRow[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => inputRef.current?.focus(), 120)
    },
  }))

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (trimmed.length < MIN_QUERY_CHARS) {
      setResults([])
      setSearching(false)
      setHasSearched(false)
      return
    }

    const seq = ++requestSeqRef.current
    setSearching(true)
    try {
      const rows = await searchUsers(supabase, trimmed)
      if (seq !== requestSeqRef.current) return
      setResults(rows)
      setHasSearched(true)
    } catch (error) {
      console.error('Friend search failed:', error)
      if (seq !== requestSeqRef.current) return
      setResults([])
      setHasSearched(true)
      toast.error('Search failed — try again')
    } finally {
      if (seq === requestSeqRef.current) setSearching(false)
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_CHARS) {
      setResults([])
      setSearching(false)
      setHasSearched(false)
      return
    }

    const timer = window.setTimeout(() => {
      void runSearch(query)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query, runSearch])

  function updateRowStatus(userId: string, next: SearchStatus) {
    setResults((rows) =>
      rows.map((row) =>
        row.user_id === userId ? { ...row, friendship_status: next } : row,
      ),
    )
  }

  async function handleAdd(userId: string, status: SearchStatus) {
    if (busyId) return
    setBusyId(userId)
    updateRowStatus(userId, 'request_sent')
    const result = await sendFriendRequest(supabase, userId)
    setBusyId(null)
    if (!result.ok) {
      updateRowStatus(userId, status)
      toast.error('Could not send friend request')
      return
    }
    const mapped = statusAfterSend(result.result)
    if (!mapped || mapped === 'self') {
      updateRowStatus(userId, status)
      toast.error(
        result.result === 'no_user'
          ? 'User not found'
          : 'Could not send friend request',
      )
      return
    }
    updateRowStatus(userId, mapped)
    toast.success(
      mapped === 'friends' ? 'You are now friends' : 'Friend request sent',
    )
    if (mapped === 'friends') onFriendshipChanged?.()
  }

  async function handleAccept(userId: string, status: SearchStatus) {
    if (busyId) return
    setBusyId(userId)
    updateRowStatus(userId, 'friends')
    const result = await acceptFriendRequest(supabase, userId)
    setBusyId(null)
    if (!result.ok || result.result !== 'accepted') {
      updateRowStatus(userId, status)
      toast.error('Could not accept request')
      return
    }
    toast.success('You are now friends')
    emitFriendRequestsChanged()
    onFriendshipChanged?.()
  }

  async function handleCancelRequest(userId: string, status: SearchStatus) {
    if (busyId) return
    setBusyId(userId)
    updateRowStatus(userId, 'none')
    const result = await removeFriend(supabase, userId)
    setBusyId(null)
    if (!result.ok) {
      updateRowStatus(userId, status)
      toast.error('Could not cancel request')
      return
    }
    toast.success('Request cancelled')
  }

  const showResultsPanel = query.trim().length >= MIN_QUERY_CHARS

  return (
    <section
      id="find"
      className={cn('mt-6 space-y-3', className)}
      aria-labelledby={`${inputId}-label`}
    >
      <div>
        <h2
          id={`${inputId}-label`}
          className="flex items-center gap-2 font-display text-xl tracking-wide text-foreground"
        >
          <Search className="h-5 w-5 text-primary" aria-hidden />
          Find friends
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Search by display name (at least {MIN_QUERY_CHARS} characters).
        </p>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find friends by name…"
          autoComplete="off"
          spellCheck={false}
          className="h-11 border-border/80 bg-card/80 pl-9 pr-10"
          aria-describedby={`${inputId}-hint`}
        />
        {searching ? (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary"
            aria-label="Searching"
          />
        ) : null}
      </div>
      <p id={`${inputId}-hint`} className="sr-only">
        Results update as you type after a short pause.
      </p>

      {showResultsPanel ? (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/60 shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
          {searching && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2
                className="h-4 w-4 animate-spin text-primary"
                aria-hidden
              />
              Searching…
            </div>
          ) : hasSearched && results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No users found
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {results.map((row) => {
                const name = row.display_name?.trim() || 'PoolCup player'
                const busy = busyId === row.user_id
                const status = row.friendship_status

                return (
                  <li
                    key={row.user_id}
                    className="flex items-center gap-3 px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserProfileLink
                          userId={row.user_id}
                          ariaLabel={`${name}'s profile`}
                          className="shrink-0"
                        >
                          <UserAvatarImage
                            avatar={resolveAvatarFilename(row.avatar)}
                            customAvatarUrl={row.custom_avatar_url}
                            className="h-10 w-10"
                          />
                        </UserProfileLink>
                        <UserProfileLink
                          userId={row.user_id}
                          className="min-w-0 truncate text-sm font-semibold text-foreground hover:underline"
                        >
                          {name}
                        </UserProfileLink>
                      </div>
                    </div>

                    {status === 'none' ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        className="h-8 shrink-0 gap-1"
                        onClick={() => void handleAdd(row.user_id, status)}
                      >
                        {busy ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Add friend
                      </Button>
                    ) : null}

                    {status === 'request_sent' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        className="h-8 shrink-0 gap-1 text-muted-foreground"
                        title="Cancel request"
                        onClick={() =>
                          void handleCancelRequest(row.user_id, status)
                        }
                      >
                        {busy ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <UserMinus className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Request sent
                      </Button>
                    ) : null}

                    {status === 'request_received' ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        className="h-8 shrink-0 gap-1"
                        onClick={() => void handleAccept(row.user_id, status)}
                      >
                        {busy ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Accept
                      </Button>
                    ) : null}

                    {status === 'friends' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled
                        className="h-8 shrink-0 gap-1 border-primary/35 bg-primary/10 text-primary"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        Friends
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
})
