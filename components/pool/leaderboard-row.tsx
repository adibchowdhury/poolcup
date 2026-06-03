'use client'

import {
  Crown,
  Flame,
  Medal,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type LeaderboardMember = {
  id: string
  name: string
  isYou: boolean
  avatar: string
  points: number
  correctPredictions: number
  totalPredictions: number
  movement: 'up' | 'down' | 'none'
  streak: number
}

interface LeaderboardRowProps {
  member: LeaderboardMember
  rank: number
  isTop3: boolean
  showRankChange?: boolean
}

export function LeaderboardRow({
  member,
  rank,
  isTop3,
  showRankChange = false,
}: LeaderboardRowProps) {
  const MovementIcon =
    member.movement === 'up'
      ? TrendingUp
      : member.movement === 'down'
        ? TrendingDown
        : Minus

  const movementColor =
    member.movement === 'up'
      ? 'text-primary'
      : member.movement === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground'

  return (
    <div
      className={cn(
        'group relative flex items-center gap-4 rounded-xl p-4 transition-all duration-300',
        member.isYou
          ? 'border border-primary/30 bg-primary/10'
          : 'hover:bg-muted/50',
        isTop3 &&
          rank === 1 &&
          'border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent',
      )}
    >
      <div className="flex w-8 justify-center">
        {rank === 1 && isTop3 ? (
          <Crown className="h-6 w-6 text-amber-400" />
        ) : rank === 2 && isTop3 ? (
          <Medal className="h-6 w-6 text-gray-300" />
        ) : rank === 3 && isTop3 ? (
          <Medal className="h-6 w-6 text-amber-600" />
        ) : (
          <span className="font-mono text-lg text-muted-foreground">{rank}</span>
        )}
      </div>

      <div
        className={cn(
          'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          member.isYou
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
          rank === 1 && isTop3 && 'ring-2 ring-amber-400 ring-offset-2 ring-offset-background',
        )}
      >
        {member.avatar}
        {member.streak >= 3 && (
          <div className="absolute -right-1 -top-1 rounded-full bg-[#ffb300] p-0.5 text-[#080b0f]">
            <Flame className="h-3 w-3" />
          </div>
        )}
      </div>

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
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
              you
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {member.correctPredictions} correct
          {member.streak >= 2 && (
            <span className="ml-2 text-[#ffb300]">{member.streak} streak</span>
          )}
        </div>
      </div>

      {showRankChange && (
        <div className={cn('flex items-center gap-1', movementColor)}>
          <MovementIcon className="h-4 w-4" />
        </div>
      )}

      <div className="text-right">
        <div className="font-display text-2xl text-foreground">{member.points}</div>
        <div className="text-xs text-muted-foreground">pts</div>
      </div>
    </div>
  )
}
