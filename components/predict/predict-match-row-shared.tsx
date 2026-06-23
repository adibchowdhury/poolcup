'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFeaturedKickoffLocal } from '@/src/lib/featured-match'

export type PredictScoreInputProps = {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  label: string
  filled: boolean
  disabled?: boolean
  readOnly?: boolean
}

export function PredictScoreInput({
  value,
  onChange,
  onBlur,
  label,
  filled,
  disabled = false,
  readOnly = false,
}: PredictScoreInputProps) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      inputMode="numeric"
      value={value}
      disabled={disabled}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      className={cn(
        'predict-score-input h-[44px] w-[44px] shrink-0 rounded-lg border text-center font-mono text-[18px] text-white outline-none transition-all duration-200',
        'bg-[#080b0f] border-[rgba(255,255,255,0.15)]',
        'focus:border-[rgba(0,230,118,0.5)] focus:shadow-[0_0_12px_rgba(0,230,118,0.2)]',
        filled && 'border-[#00e676] text-[#00e676]',
        (disabled || readOnly) &&
          'cursor-not-allowed opacity-50 focus:border-[rgba(255,255,255,0.15)] focus:shadow-none',
      )}
      aria-label={label}
    />
  )
}

export function getCompactMatchRowContainerClassName({
  isLocked = false,
  isPredicted = false,
  filled = false,
  variant = 'compact',
}: {
  isLocked?: boolean
  isPredicted?: boolean
  filled?: boolean
  variant?: 'compact' | 'prominent'
} = {}): string {
  const prominent = variant === 'prominent'

  return cn(
    'group relative flex w-full min-w-0 flex-col items-stretch gap-2 rounded-lg border border-border/90 bg-card/90 shadow-sm backdrop-blur-sm transition-all duration-200 sm:gap-3',
    'hover:border-primary/25 hover:bg-card hover:shadow-[0_4px_20px_rgba(0,0,0,0.25)]',
    prominent ? 'min-h-[72px] px-4 py-4' : 'min-h-[52px] px-4 py-3',
    isLocked &&
      'border-border/60 bg-muted/25 hover:border-border/60 hover:bg-muted/25 hover:shadow-sm',
    isPredicted && filled && !isLocked && 'border-primary/20',
  )
}

/** Secondary labels on locked/past rows — uses --muted-on-section for AA contrast on card bg */
export function getPastMatchMetaTextClassName(): string {
  return 'text-muted-on-section'
}

/** Supporting body copy on locked/past rows (e.g. actual result) */
export function getPastMatchBodyTextClassName(): string {
  return 'text-foreground/85'
}

export function getCompactMatchRowTeamsRowClassName(): string {
  return 'flex w-full min-w-0 items-center gap-2 sm:gap-3'
}

export function getCompactMatchRowScoreColumnClassName(): string {
  return 'relative z-10 flex shrink-0 flex-col items-center gap-1 px-0.5'
}

export function getCompactMatchRowScoreGroupClassName(): string {
  return 'relative z-10 flex shrink-0 items-center gap-1 px-0.5'
}

export function CompactMatchRowPredictedBadge({
  isPredicted = false,
  filled = false,
  isLocked = false,
}: {
  isPredicted?: boolean
  filled?: boolean
  isLocked?: boolean
}) {
  if (!isPredicted || !filled || isLocked) {
    return null
  }

  return (
    <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow-[0_0_8px_rgba(0,230,118,0.5)]">
      <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
    </div>
  )
}

export function CompactMatchRowScoreSeparator() {
  return (
    <span className="px-0.5 font-mono text-sm text-muted-on-section">–</span>
  )
}

export function CompactMatchRowKickoffTime({
  kickoffAt,
  isLocked = false,
  className,
}: {
  kickoffAt: string
  isLocked?: boolean
  className?: string
}) {
  return (
    <time
      dateTime={kickoffAt}
      suppressHydrationWarning
      className={cn(
        'shrink-0 text-[10px] tabular-nums sm:text-xs',
        isLocked ? 'text-muted-on-section' : 'text-muted-foreground',
        className,
      )}
    >
      {formatFeaturedKickoffLocal(kickoffAt)}
    </time>
  )
}

export function CompactMatchRowReadOnlyScores({
  score1,
  score2,
}: {
  score1: number
  score2: number
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 font-mono text-[18px] text-foreground">
      <span className="tabular-nums">{score1}</span>
      <CompactMatchRowScoreSeparator />
      <span className="tabular-nums">{score2}</span>
    </div>
  )
}
