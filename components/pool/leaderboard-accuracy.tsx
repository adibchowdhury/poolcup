import { cn } from '@/lib/utils'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'

export function getAccuracyPercent(
  correctPredictions: number,
  totalPredictions: number,
): number {
  if (totalPredictions === 0) return 0
  return Math.round((correctPredictions / totalPredictions) * 100)
}

export function LeaderboardAccuracyBlock({
  member,
  className,
}: {
  member: LeaderboardMember
  className?: string
}) {
  const percent = getAccuracyPercent(
    member.correctPredictions,
    member.totalPredictions,
  )

  return (
    <div className={cn('w-full space-y-1', className)}>
      <p className="text-xs text-muted-foreground">
        {member.correctPredictions} correct
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{percent}%</p>
    </div>
  )
}
