import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'
import { cn } from '@/lib/utils'

interface ScoringModeBadgeProps {
  scoringStyle: string
  className?: string
}

export function ScoringModeBadge({
  scoringStyle,
  className,
}: ScoringModeBadgeProps) {
  return (
    <span
      className={cn(
        'rounded-full border border-primary/30 bg-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary',
        className,
      )}
    >
      {formatScoringStyleLabel(scoringStyle)}
    </span>
  )
}
