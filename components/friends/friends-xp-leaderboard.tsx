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
}

/**
 * Ranked list of you + friends by XP (global currency). Not pool points.
 */
export function FriendsXpLeaderboard({ rows, solo }: FriendsXpLeaderboardProps) {
  return (
    <section className="mt-8 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-xl tracking-wide text-foreground">
            <Trophy className="h-5 w-5 text-amber-300" aria-hidden />
            Friends leaderboard
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ranked by XP (badges &amp; level) — not pool points.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-amber-400/20 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.12),transparent_45%),linear-gradient(160deg,rgba(22,28,18,0.98),rgba(8,12,10,0.99))] shadow-[0_14px_36px_rgba(0,0,0,0.28)]">
        <div className="h-1 bg-gradient-to-r from-amber-400/80 via-primary/60 to-amber-400/40" />

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Leaderboard unavailable right now.
          </p>
        ) : (
          <ol className="divide-y divide-white/[0.06] p-2">
            {rows.map((row) => {
              const name = row.display_name?.trim() || 'PoolCup player'
              return (
                <li
                  key={row.user_id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-3',
                    row.is_me &&
                      'border border-primary/35 bg-primary/10 shadow-[0_0_0_1px_rgba(0,230,118,0.08)_inset]',
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
                    className="shrink-0"
                  >
                    <UserAvatarImage
                      avatar={resolveAvatarFilename(row.avatar)}
                      customAvatarUrl={row.custom_avatar_url}
                      className={cn(
                        'h-10 w-10',
                        row.is_me && 'ring-2 ring-primary/45',
                      )}
                    />
                  </UserProfileLink>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserProfileLink
                        userId={row.user_id}
                        className={cn(
                          'min-w-0 truncate text-sm font-semibold hover:underline',
                          row.is_me ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {name}
                      </UserProfileLink>
                      {row.is_me ? (
                        <span className="shrink-0 rounded-full border border-primary/30 bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          You
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                      <Zap className="h-3 w-3 text-amber-300/80" aria-hidden />
                      {row.total_xp.toLocaleString()} XP
                    </p>
                  </div>

                  <span
                    className={cn(
                      'shrink-0 font-display text-lg tabular-nums tracking-wide',
                      row.rank <= 3 ? 'text-amber-200' : 'text-muted-foreground',
                    )}
                  >
                    #{row.rank}
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        {solo ? (
          <div className="border-t border-white/[0.06] px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              Add friends to compete on this XP board.
            </p>
            <Link
              href="/dashboard"
              className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline"
            >
              Find players from pools &amp; leaderboards →
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}
