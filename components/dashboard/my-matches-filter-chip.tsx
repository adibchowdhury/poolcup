'use client'

import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

type MyMatchesFilterChipProps = {
  active: boolean
  onToggle: () => void
  className?: string
}

/** Toggle pill for the Matches tab — distinct from sport bubbles. */
export function MyMatchesFilterChip({
  active,
  onToggle,
  className,
}: MyMatchesFilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
        FOCUS_VISIBLE_RING,
        active
          ? 'border-primary/50 bg-primary/15 text-primary shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_25%,transparent)]'
          : 'border-[#292929] bg-[#171717] text-muted-foreground hover:border-border hover:text-foreground',
        className,
      )}
    >
      My matches
    </button>
  )
}
