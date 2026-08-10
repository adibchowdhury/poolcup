'use client'

import { cn } from '@/lib/utils'
import { LeaderboardAccuracyBlock } from '@/components/pool/leaderboard-accuracy'
import { UserAvatarImage } from '@/components/user-avatar-image'

export type LeaderboardPointBreakdownItem = {
  matchId: string
  predTeam1: number
  predTeam2: number
  pointsAwarded: number
  reasonLabel: string
  team1Name: string
  team2Name: string
  resultTeam1: number
  resultTeam2: number
  round: string
  groupName: string | null
  kickoffAt: string
  /** Winner-only group / third-place lines use a fixed label instead of a matchup. */
  displayLabel?: string
  /** Distinct key when one match is split into multiple breakdown lines. */
  lineId?: string
}

export type LeaderboardMember = {
  id: string
  userId: string
  name: string
  isYou: boolean
  avatar: string | null
  customAvatarUrl: string | null
  points: number
  correctPredictions: number
  /** Exact scoreline hits from leaderboard_cache.exact_scores (classic pools). */
  exactScores: number
  totalPredictions: number
  /** Cache rank (1-based); used with prevRank for movement. */
  rank: number
  prevRank: number | null
  /** Absolute places moved vs prev_rank; 0 if unchanged/new. */
  rankDelta: number
  movement: 'up' | 'down' | 'none'
  /** Climb momentum from leaderboard_cache.climb_streak. */
  climbStreak: number
  /** @deprecated Prefer climbStreak; kept for older UI that keyed off streak. */
  streak: number
  /** Classic + winner pools: per-line points when expandable breakdown is enabled. */
  pointBreakdown?: LeaderboardPointBreakdownItem[]
}

interface LeaderboardRowProps {
  member: LeaderboardMember
  rank: number
}

export function LeaderboardRow({ member, rank }: LeaderboardRowProps) {
  return (
    <div
      className={cn(
        'group relative flex items-center gap-4 rounded-xl p-4 transition-all duration-300',
        member.isYou
          ? 'border border-primary/30 bg-primary/10'
          : 'hover:bg-muted/50',
      )}
    >
      <div className="flex w-8 shrink-0 justify-center">
        <span className="font-mono text-lg text-muted-foreground">{rank}</span>
      </div>

      <UserAvatarImage
        avatar={member.avatar}
        customAvatarUrl={member.customAvatarUrl}
        className={cn(
          'h-10 w-10',
          member.isYou && 'ring-2 ring-primary/40',
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate font-medium',
              member.isYou ? 'text-primary' : 'text-foreground',
            )}
          >
            {member.name}
          </span>
          {member.isYou && (
            <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
              you
            </span>
          )}
        </div>
        <LeaderboardAccuracyBlock member={member} className="mt-2 max-w-xs" />
      </div>

      <div className="shrink-0 text-right">
        <div className="font-display text-2xl text-foreground">{member.points}</div>
        <div className="text-xs text-muted-foreground">pts</div>
      </div>
    </div>
  )
}
