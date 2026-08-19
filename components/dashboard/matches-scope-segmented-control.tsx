'use client'

import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

export type MatchesScope = 'all' | 'mine'

type MatchesScopeSegmentedControlProps = {
  value: MatchesScope
  onChange: (value: MatchesScope) => void
  className?: string
  size?: 'default' | 'lg'
}

const OPTIONS: { value: MatchesScope; label: string }[] = [
  { value: 'all', label: 'All matches' },
  { value: 'mine', label: 'My matches' },
]

/** Desktop Matches tab — scope filter (all vs pool events). */
export function MatchesScopeSegmentedControl({
  value,
  onChange,
  className,
  size = 'default',
}: MatchesScopeSegmentedControlProps) {
  const isLg = size === 'lg'

  return (
    <div
      role="group"
      aria-label="Match scope"
      className={cn(
        'inline-flex shrink-0 border border-[#292929] bg-[#171717]',
        isLg ? 'rounded-xl p-1' : 'rounded-lg p-0.5',
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'font-semibold transition-colors',
              isLg
                ? 'rounded-lg px-4 py-2 text-sm'
                : 'rounded-md px-3 py-1.5 text-xs',
              FOCUS_VISIBLE_RING,
              selected
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
