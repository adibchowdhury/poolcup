'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CompactTeam {
  name: string
  flag: string
}

export interface CompactMatchRowProps {
  homeTeam: CompactTeam
  awayTeam: CompactTeam
  homeScore: string
  awayScore: string
  onHomeScoreChange: (value: string) => void
  onAwayScoreChange: (value: string) => void
  isLocked?: boolean
  isPredicted?: boolean
}

const scoreInputClass = (filled: boolean) =>
  cn(
    'h-9 w-9 min-h-[36px] min-w-[36px] sm:h-10 sm:w-10 sm:min-h-[40px] sm:min-w-[40px]',
    'rounded-md border-2 bg-background/80 text-center font-mono text-base font-bold sm:text-lg',
    'outline-none transition-all duration-200',
    'focus:border-primary focus:shadow-[0_0_12px_rgba(0,230,118,0.35)] focus:ring-0',
    filled
      ? 'border-primary/80 text-foreground shadow-[0_0_8px_rgba(0,230,118,0.15)]'
      : 'border-border/80 text-muted-foreground hover:border-primary/40',
  )

export function CompactMatchRow({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  onHomeScoreChange,
  onAwayScoreChange,
  isLocked = false,
  isPredicted = false,
}: CompactMatchRowProps) {
  const filled = homeScore !== '' && awayScore !== ''

  return (
    <div
      className={cn(
        'group relative flex h-[52px] items-center gap-2 rounded-lg border border-border/90 bg-card/90 px-2.5 sm:px-3',
        'shadow-sm backdrop-blur-sm transition-all duration-200',
        'hover:border-primary/25 hover:bg-card hover:shadow-[0_4px_20px_rgba(0,0,0,0.25)]',
        isLocked && 'opacity-55 hover:border-border/90 hover:shadow-sm',
        isPredicted && filled && !isLocked && 'border-primary/20',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <span className="shrink-0 text-base leading-none sm:text-lg" aria-hidden>
          {homeTeam.flag || '🏳️'}
        </span>
        <span className="truncate text-xs font-semibold text-foreground sm:text-sm">
          {homeTeam.name}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {isLocked ? (
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Locked
          </span>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={homeScore}
              onChange={(e) => onHomeScoreChange(e.target.value)}
              className={scoreInputClass(homeScore !== '')}
              placeholder="–"
              aria-label={`${homeTeam.name} score`}
            />
            <span className="px-0.5 font-mono text-sm text-muted-foreground/80">–</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={awayScore}
              onChange={(e) => onAwayScoreChange(e.target.value)}
              className={scoreInputClass(awayScore !== '')}
              placeholder="–"
              aria-label={`${awayTeam.name} score`}
            />
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <span className="truncate text-right text-xs font-semibold text-foreground sm:text-sm">
          {awayTeam.name}
        </span>
        <span className="shrink-0 text-base leading-none sm:text-lg" aria-hidden>
          {awayTeam.flag || '🏳️'}
        </span>
      </div>

      {isPredicted && filled && !isLocked && (
        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow-[0_0_8px_rgba(0,230,118,0.5)]">
          <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
        </div>
      )}
    </div>
  )
}
