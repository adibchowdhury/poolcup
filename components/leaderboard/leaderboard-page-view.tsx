'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  Medal,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/src/lib/auth-context'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import {
  fetchFriendsXpLeaderboard,
  fetchGlobalXpLeaderboardPage,
  fetchUserGlobalRank,
  GLOBAL_XP_LEADERBOARD_PAGE_SIZE,
  type GlobalXpLeaderboardRow,
  type UserGlobalRank,
} from '@/src/lib/global-rank'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'

export type LeaderboardScope = 'global' | 'friends'

const MEDAL_COLORS: Record<1 | 2 | 3, string> = {
  1: '#BA7517',
  2: '#888780',
  3: '#D85A30',
}

function RankBadge({ rank }: { rank: number }) {
  if (rank >= 1 && rank <= 3) {
    return (
      <Medal
        className="h-5 w-5 shrink-0"
        style={{ color: MEDAL_COLORS[rank as 1 | 2 | 3] }}
        aria-hidden
      />
    )
  }
  return (
    <span className="w-5 shrink-0 text-center font-display text-sm tabular-nums text-muted-foreground">
      {rank}
    </span>
  )
}

function displayLabel(row: {
  display_name: string | null
  username?: string | null
}): string {
  const name = row.display_name?.trim()
  if (name) return name
  const username = row.username?.trim()
  if (username) return `@${username}`
  return 'PoolCup player'
}

function LeaderboardRowItem({
  row,
  isYou,
}: {
  row: GlobalXpLeaderboardRow
  isYou: boolean
}) {
  const name = displayLabel(row)
  const username = row.username?.trim()

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-3',
        isYou &&
          'border border-primary/35 bg-primary/10 shadow-[0_0_0_1px_rgba(0,230,118,0.08)_inset]',
      )}
    >
      <div
        className="flex w-8 shrink-0 items-center justify-center"
        aria-label={`Rank ${row.global_rank}`}
      >
        <RankBadge rank={row.global_rank} />
      </div>

      <UserProfileLink
        userId={row.user_id}
        username={row.username}
        ariaLabel={`${name}'s profile`}
        className={cn('shrink-0 rounded-full', FOCUS_RING)}
      >
        <UserAvatarImage
          avatar={resolveAvatarFilename(row.avatar)}
          customAvatarUrl={row.custom_avatar_url}
          className={cn('h-10 w-10', isYou && 'ring-2 ring-primary/60')}
        />
      </UserProfileLink>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <UserProfileLink
            userId={row.user_id}
            className={cn(
              'truncate text-sm font-semibold text-foreground hover:underline',
              FOCUS_RING,
              'rounded-sm',
            )}
          >
            {name}
          </UserProfileLink>
          {isYou ? (
            <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              You
            </span>
          ) : null}
        </div>
        {username && row.display_name?.trim() ? (
          <p className="truncate text-xs text-muted-foreground">@{username}</p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className="font-display text-lg tabular-nums text-primary">
          {row.total_xp.toLocaleString()}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          XP
        </p>
      </div>
    </li>
  )
}

function BoardSkeleton() {
  return (
    <div className="space-y-2 p-2" aria-busy="true" aria-label="Loading leaderboard">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl px-3 py-3"
        >
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-5 w-12 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function LeaderboardPageView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const viewedRef = useRef<LeaderboardScope | null>(null)

  const scopeParam = searchParams.get('scope')
  const initialScope: LeaderboardScope =
    scopeParam === 'friends' ? 'friends' : 'global'

  const [scope, setScope] = useState<LeaderboardScope>(initialScope)
  const [globalRows, setGlobalRows] = useState<GlobalXpLeaderboardRow[]>([])
  const [friendsRows, setFriendsRows] = useState<
    Array<GlobalXpLeaderboardRow & { is_me: boolean }>
  >([])
  const [totalRanked, setTotalRanked] = useState(0)
  const [offset, setOffset] = useState(0)
  const [viewerRank, setViewerRank] = useState<UserGlobalRank | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?next=/leaderboard')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    const next: LeaderboardScope =
      searchParams.get('scope') === 'friends' ? 'friends' : 'global'
    setScope(next)
  }, [searchParams])

  const loadGlobal = useCallback(
    async (nextOffset: number, append: boolean) => {
      if (!user) return
      if (append) setLoadingMore(true)
      else {
        setLoading(true)
        setError(null)
      }

      const [page, me] = await Promise.all([
        fetchGlobalXpLeaderboardPage(supabase, {
          limit: GLOBAL_XP_LEADERBOARD_PAGE_SIZE,
          offset: nextOffset,
        }),
        fetchUserGlobalRank(supabase, user.id),
      ])

      if (page.error) {
        setError(page.error)
        if (!append) setGlobalRows([])
      } else {
        setError(null)
        setGlobalRows((prev) =>
          append ? [...prev, ...page.rows] : page.rows,
        )
        setTotalRanked(page.total_ranked)
        setOffset(nextOffset + page.rows.length)
      }
      setViewerRank(me)
      setLoading(false)
      setLoadingMore(false)
    },
    [user],
  )

  const loadFriends = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    const [board, me] = await Promise.all([
      fetchFriendsXpLeaderboard(supabase),
      fetchUserGlobalRank(supabase, user.id),
    ])

    if (board.error) {
      setError(board.error)
      setFriendsRows([])
    } else {
      setFriendsRows(board.rows)
    }
    setViewerRank(me)
    setLoading(false)
  }, [user])

  const reload = useCallback(async () => {
    if (scope === 'global') {
      setOffset(0)
      await loadGlobal(0, false)
    } else {
      await loadFriends()
    }
  }, [scope, loadGlobal, loadFriends])

  useEffect(() => {
    if (authLoading || !user) return
    void reload()
  }, [authLoading, user, scope, reload])

  useEffect(() => {
    if (loading || error || viewedRef.current === scope) return
    viewedRef.current = scope
    capturePostHog('leaderboard_viewed', { type: scope })
  }, [loading, error, scope])

  function setScopeAndUrl(next: LeaderboardScope) {
    if (next === scope) return
    setScope(next)
    viewedRef.current = null
    capturePostHog('leaderboard_scope_changed', { type: next })
    const href =
      next === 'friends' ? '/leaderboard?scope=friends' : '/leaderboard'
    router.replace(href, { scroll: false })
  }

  const hasMore =
    scope === 'global' &&
    !loading &&
    !error &&
    globalRows.length < totalRanked &&
    globalRows.length > 0

  const viewerOnPage = useMemo(() => {
    if (!user) return false
    if (scope === 'global') {
      return globalRows.some((r) => r.user_id === user.id)
    }
    return friendsRows.some((r) => r.user_id === user.id || r.is_me)
  }, [user, scope, globalRows, friendsRows])

  const friendsSolo = scope === 'friends' && !loading && friendsRows.length <= 1

  if (authLoading || !user) {
    return (
      <main
        className={cn(
          'flex min-h-screen items-center justify-center bg-background',
          MOBILE_BOTTOM_NAV_PAD_CLASS,
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main
      className={cn(
        'min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/dashboard"
              className={cn(
                'inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                FOCUS_RING,
                'rounded-md',
              )}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Dashboard
            </Link>
            <h1 className="mt-3 flex items-center gap-2 font-display text-2xl tracking-wide text-foreground sm:text-3xl">
              <Trophy className="h-6 w-6 text-amber-300" aria-hidden />
              Leaderboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked by XP from badges — not pool points.
            </p>
          </div>
        </div>

        <div
          className="flex rounded-xl border border-border bg-card/60 p-1"
          role="tablist"
          aria-label="Leaderboard scope"
        >
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'global'}
            onClick={() => setScopeAndUrl('global')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              FOCUS_RING,
              scope === 'global'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Zap className="h-4 w-4" aria-hidden />
            Global
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'friends'}
            onClick={() => setScopeAndUrl('friends')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              FOCUS_RING,
              scope === 'friends'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Users className="h-4 w-4" aria-hidden />
            Friends
          </button>
        </div>

        {viewerRank && scope === 'global' ? (
          <div
            className={cn(
              'sticky top-2 z-10 rounded-2xl border border-primary/40 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-md',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Your rank
                </p>
                <p className="font-display text-xl tabular-nums text-foreground">
                  {viewerRank.global_rank != null
                    ? `#${viewerRank.global_rank}`
                    : 'Unranked'}
                  {viewerRank.total_ranked > 0 ? (
                    <span className="ml-1 text-sm font-sans font-normal text-muted-foreground">
                      of {viewerRank.total_ranked.toLocaleString()}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl tabular-nums text-primary">
                  {viewerRank.total_xp.toLocaleString()}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  XP
                </p>
              </div>
            </div>
            {!viewerOnPage && viewerRank.global_rank != null ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                You’re not on this page — keep scrolling or load more to find
                your row.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="hue-card-surface overflow-hidden rounded-2xl border border-amber-400/20 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.12),transparent_45%),linear-gradient(160deg,rgba(22,28,18,0.98),rgba(8,12,10,0.99))] shadow-[0_14px_36px_rgba(0,0,0,0.28)]">
          <div className="h-1 bg-gradient-to-r from-amber-400/80 via-primary/60 to-amber-400/40" />

          {loading ? (
            <BoardSkeleton />
          ) : error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Couldn’t load the leaderboard.
              </p>
              <p className="mt-1 text-xs text-destructive/90">{error}</p>
              <Button
                type="button"
                variant="outline"
                className={cn('mt-4', FOCUS_RING)}
                onClick={() => void reload()}
              >
                Try again
              </Button>
            </div>
          ) : scope === 'friends' && friendsRows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                No friends yet — add friends to compare
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Find people you know and climb the XP board together.
              </p>
              <Button asChild className={cn('mt-4', FOCUS_RING)}>
                <Link href="/friends#find">Find friends</Link>
              </Button>
            </div>
          ) : scope === 'friends' && friendsSolo ? (
            <div className="space-y-2 p-2">
              <ol className="divide-y divide-white/[0.06]">
                {friendsRows.map((row) => (
                  <LeaderboardRowItem
                    key={row.user_id}
                    row={row}
                    isYou={row.is_me || row.user_id === user.id}
                  />
                ))}
              </ol>
              <div className="px-3 pb-4 pt-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Add friends to see how you stack up.
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={cn('mt-3', FOCUS_RING)}
                >
                  <Link href="/friends#find">Find friends</Link>
                </Button>
              </div>
            </div>
          ) : scope === 'global' && globalRows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No ranked players yet. Earn badges to climb the board.
              </p>
              <Button asChild className={cn('mt-4', FOCUS_RING)}>
                <Link href="/achievements">Browse achievements</Link>
              </Button>
            </div>
          ) : (
            <>
              {scope === 'global' && totalRanked > 0 ? (
                <p className="border-b border-white/[0.06] px-4 py-2 text-xs text-muted-foreground">
                  Showing {globalRows.length.toLocaleString()} of{' '}
                  {totalRanked.toLocaleString()} players
                </p>
              ) : null}
              <ol className="divide-y divide-white/[0.06] p-2">
                {scope === 'global'
                  ? globalRows.map((row) => (
                      <LeaderboardRowItem
                        key={row.user_id}
                        row={row}
                        isYou={row.user_id === user.id}
                      />
                    ))
                  : friendsRows.map((row) => (
                      <LeaderboardRowItem
                        key={row.user_id}
                        row={row}
                        isYou={row.is_me || row.user_id === user.id}
                      />
                    ))}
              </ol>

              {hasMore ? (
                <div className="border-t border-white/[0.06] p-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loadingMore}
                    className={cn('w-full', FOCUS_RING)}
                    onClick={() => {
                      capturePostHog('leaderboard_load_more', {
                        type: 'global',
                        offset,
                      })
                      void loadGlobal(offset, true)
                    }}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden
                        />
                        Loading…
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
