'use client'

import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'
import type { WinnerPick } from '@/src/lib/winner-pick-storage'

type StackedDensity = 'mobile' | 'desktop'

function pickButtonClassName(
  selected: boolean,
  disabled: boolean,
  density: StackedDensity,
): string {
  return cn(
    'flex w-full min-w-0 items-center justify-center rounded-lg border text-center font-semibold leading-snug transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
    density === 'mobile'
      ? 'px-1.5 py-1.5 text-[10px]'
      : 'px-2 py-2 text-[11px]',
    selected
      ? 'border-primary bg-primary/15 text-primary'
      : 'border-border bg-muted/40 text-foreground hover:border-primary/40',
    disabled && 'pointer-events-none opacity-50',
  )
}

function TeamPickColumn({
  teamName,
  dbFlag,
  logoUrl,
  selected,
  disabled,
  onClick,
  density,
}: {
  teamName: string
  dbFlag: string | null
  logoUrl?: string | null
  selected: boolean
  disabled: boolean
  onClick?: () => void
  density: StackedDensity
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center',
        density === 'mobile' ? 'gap-1.5' : 'gap-2',
      )}
    >
      <TeamFlagImage
        countryName={teamName}
        dbFlag={dbFlag}
        logoUrl={logoUrl ?? null}
        imgClassName={cn(
          'w-auto shrink-0 object-contain',
          density === 'mobile' ? 'h-8' : 'h-10',
        )}
        emojiClassName={cn(
          'leading-none',
          density === 'mobile' ? 'text-2xl' : 'text-3xl',
        )}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={`Pick ${teamName} to win`}
        className={pickButtonClassName(selected, disabled, density)}
      >
        <span className="line-clamp-2 min-w-0 break-words">{teamName}</span>
      </button>
    </div>
  )
}

type WinnerPickStackedLayoutProps = {
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
  team1Logo?: string | null
  team2Logo?: string | null
  selected: WinnerPick | null
  allowDraw: boolean
  disabled: boolean
  onPick?: (pick: WinnerPick) => void
  className?: string
  density: StackedDensity
}

function WinnerPickStackedLayout({
  team1Name,
  team2Name,
  team1Flag,
  team2Flag,
  team1Logo = null,
  team2Logo = null,
  selected,
  allowDraw,
  disabled,
  onPick,
  className,
  density,
}: WinnerPickStackedLayoutProps) {
  return (
    <div
      className={cn(
        'grid w-full min-w-0 max-w-full items-end',
        density === 'mobile' ? 'gap-1.5' : 'gap-2',
        allowDraw
          ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
          : 'grid-cols-2',
        className,
      )}
    >
      <TeamPickColumn
        teamName={team1Name}
        dbFlag={team1Flag}
        logoUrl={team1Logo}
        selected={selected === 'team1'}
        disabled={disabled}
        density={density}
        onClick={onPick ? () => onPick('team1') : undefined}
      />
      {allowDraw ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onPick ? () => onPick('draw') : undefined}
          aria-label="Pick draw"
          className={cn(
            pickButtonClassName(selected === 'draw', disabled, density),
            'mb-0 shrink-0 self-end',
            density === 'mobile' ? 'px-2 py-1.5' : 'px-3 py-2',
          )}
        >
          Draw
        </button>
      ) : null}
      <TeamPickColumn
        teamName={team2Name}
        dbFlag={team2Flag}
        logoUrl={team2Logo}
        selected={selected === 'team2'}
        disabled={disabled}
        density={density}
        onClick={onPick ? () => onPick('team2') : undefined}
      />
    </div>
  )
}

/** lg+ winner-only: logo stacked above name-only pick button per side; draw centered. */
export function WinnerPickDesktopLayout(
  props: Omit<WinnerPickStackedLayoutProps, 'density'>,
) {
  return <WinnerPickStackedLayout {...props} density="desktop" />
}

/** Below lg winner-only: same anatomy as desktop, tighter for narrow cards. */
export function WinnerPickMobileLayout(
  props: Omit<WinnerPickStackedLayoutProps, 'density'>,
) {
  return <WinnerPickStackedLayout {...props} density="mobile" />
}
