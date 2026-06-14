'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { LeaderboardAccuracyBlock } from '@/components/pool/leaderboard-accuracy'
import { getAvatarSrc } from '@/src/lib/avatars'

export type LeaderboardMember = {
  id: string
  name: string
  isYou: boolean
  avatar: string | null
  points: number
  correctPredictions: number
  totalPredictions: number
  movement: 'up' | 'down' | 'none'
  streak: number
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

      <div
        className={cn(
          'relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold',
          member.isYou
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {member.avatar ? (
          <Image
            src={getAvatarSrc(member.avatar)}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 object-cover object-top"
          />
        ) : (
          member.name.charAt(0).toUpperCase()
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
