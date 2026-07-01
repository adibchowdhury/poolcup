'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function TeamMonogram({ code }: { code: string }) {
  return (
    <div
      className={cn(
        'flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-xl',
        'border border-white/10 bg-white/[0.06]',
      )}
      aria-hidden
    >
      <span className="font-display text-lg tracking-wider text-foreground">
        {code}
      </span>
    </div>
  )
}

type MobileMatchListCardProps = {
  accentLabel: string
  headerRight: ReactNode
  team1Name: string
  team2Name: string
  team1Visual: ReactNode
  team2Visual: ReactNode
  centerContent: ReactNode
  footer: ReactNode
  interactive?: boolean
  onPress?: () => void
  ariaLabel: string
}

export function MobileMatchListCard({
  accentLabel,
  headerRight,
  team1Name,
  team2Name,
  team1Visual,
  team2Visual,
  centerContent,
  footer,
  interactive = false,
  onPress,
  ariaLabel,
}: MobileMatchListCardProps) {
  const className = cn(
    'w-full overflow-hidden rounded-2xl border border-border/90 bg-card/90 text-left',
    'px-3 py-3.5 shadow-[0_2px_14px_rgba(0,0,0,0.32)]',
    interactive &&
      'transition-colors hover:border-border hover:bg-card active:bg-card/80 cursor-pointer',
  )

  const body = (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          {accentLabel}
        </p>
        {headerRight}
      </div>

      <div className="flex items-center gap-1">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          {team1Visual}
          <span className="w-full break-words text-center text-sm font-bold leading-snug text-foreground">
            {team1Name}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center self-center px-0.5">
          {centerContent}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          {team2Visual}
          <span className="w-full break-words text-center text-sm font-bold leading-snug text-foreground">
            {team2Name}
          </span>
        </div>
      </div>

      {footer}
    </>
  )

  if (interactive && onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className={className}
        aria-label={ariaLabel}
      >
        {body}
      </button>
    )
  }

  return (
    <article className={className} aria-label={ariaLabel}>
      {body}
    </article>
  )
}
