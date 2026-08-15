'use client'

import Link from 'next/link'
import { Medal, Trophy, Zap } from 'lucide-react'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { resolveAvatarFilename } from '@/src/lib/avatars'
import type { FriendsLeaderboardRow } from '@/src/lib/friendships'
import { cn } from '@/lib/utils'

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

type FriendsXpLeaderboardProps = {
  rows: FriendsLeaderboardRow[]
  /** True when the user has zero accepted friends (solo board). */
  solo: boolean
  className?: string
}

/**
 * Compact friends XP preview on /friends. Full board: /leaderboard?scope=friends
 */
export function FriendsXpLeaderboard({
  rows,
  solo,
  className,
}: FriendsXpLeaderboardProps) {
  return (
    <section className={cn('mt-8 space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-xl tracking-wide text-foreground">
            <Trophy className="h-5 w-5 text-amber-300" aria-hidden />
            Friends leaderboard
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ranked by XP (ledger) — not pool points.
          </p>
        </div>
        <Link
          href="/leaderboard?scope=friends"
          className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md"
        >
          Full board
        </Link>
      </div>

      <div className="hue-card-surface overflow-hidden rounded-2xl border border-amber-400/20 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.12),transparent_45%),linear-gradient(160deg,rgba(22,28,18,0.98),rgba(8,12,10,0.99))] shadow-[0_14px_36px_rgba(0,0,0,0.28)]">
        <div className="h-1 bg-gradient-to-r from-amber-400/80 via-primary/60 to-amber-400/40" />

        {solo || rows.length <= 1 ? (
          <div className="space-y-3 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              No friends yet — add friends to compare
            </p>
            <p className="text-sm text-muted-foreground">
              Find people you know, then climb the XP board together.
            </p>
            <Link
              href="/friends/find"
              className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md"
            >
              Find friends
            </Link>
          </div>
        ) : rows.length === 0 ? (
          <div className="space-y-3 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Leaderboard unavailable right now.
            </p>
            <Link
              href="/leaderboard?scope=friends"
              className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md"
            >
              Try the XP leaderboard
            </Link>
          </div>
        ) : (
          <ol className="divide-y divide-white/[0.06] p-2">
            {rows.slice(0, 5).map((row) => {
              const name = row.display_name?.trim() || 'PoolCup player'
              return (
                <li
                  key={row.user_id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-3',
                    row.is_me &&
                      'border border-primary/35 bg-primary/10 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_8%,transparent)_inset]',
                  )}
                >
                  <div
                    className="flex w-8 shrink-0 items-center justify-center"
                    aria-label={`Rank ${row.rank}`}
                  >
                    <RankBadge rank={row.rank} />
                  </div>
                  <UserProfileLink
                    userId={row.user_id}
                    ariaLabel={`${name}'s profile`}
                    className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <UserAvatarImage
                      avatar={resolveAvatarFilename(row.avatar)}
                      customAvatarUrl={row.custom_avatar_url}
                      className={cn(
                        'h-10 w-10',
                        row.is_me && 'ring-2 ring-primary/60',
                      )}
                    />
                  </UserProfileLink>
                  <div className="min-w-0 flex-1">
                    <UserProfileLink
                      userId={row.user_id}
                      className="truncate text-sm font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-sm"
                    >
                      {name}
                      {row.is_me ? ' (You)' : ''}
                    </UserProfileLink>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="inline-flex items-center gap-1 font-display text-lg tabular-nums text-primary">
                      <Zap className="h-3.5 w-3.5" aria-hidden />
                      {row.total_xp.toLocaleString()}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
