'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  countryNameToFlagSrc,
  hasFlagImage,
  resolveTeamFlagDisplay,
} from '@/src/lib/team-flags'
import type { CompactTeam } from './compact-match-row'

export type WinnerPick = 'home' | 'away' | null

export interface WinnerOnlyMatchRowProps {
  homeTeam: CompactTeam
  awayTeam: CompactTeam
  selected: WinnerPick
  onSelect: (pick: WinnerPick) => void
  isLocked?: boolean
  isPredicted?: boolean
  variant?: 'compact' | 'prominent'
}

function TeamFlagImage({ countryName }: { countryName: string }) {
  const flagSrc = countryNameToFlagSrc(countryName)
  const [imageFailed, setImageFailed] = useState(false)
  const showFlagImage = hasFlagImage(countryName)

  useEffect(() => {
    setImageFailed(false)
  }, [flagSrc, showFlagImage])

  if (!showFlagImage || imageFailed) {
    return (
      <span className="text-2xl leading-none" aria-hidden>
        {resolveTeamFlagDisplay(countryName, null)}
      </span>
    )
  }

  return (
    <img
      src={flagSrc}
      alt=""
      className="h-8 w-auto shrink-0 sm:h-9"
      onError={() => setImageFailed(true)}
    />
  )
}

function WinnerTeamButton({
  team,
  side,
  selected,
  dimmed,
  disabled,
  onClick,
  prominent,
}: {
  team: CompactTeam
  side: 'home' | 'away'
  selected: boolean
  dimmed: boolean
  disabled: boolean
  onClick: () => void
  prominent: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Pick ${team.name} to win`}
      className={cn(
        'flex min-h-[88px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 px-3 py-4 transition-all duration-200',
        prominent && 'min-h-[100px] sm:min-h-[108px]',
        selected
          ? 'border-primary bg-primary/15 shadow-[0_0_16px_rgba(0,230,118,0.15)]'
          : 'border-border/80 bg-card/80 hover:border-primary/35 hover:bg-card',
        dimmed && !selected && 'opacity-50',
        disabled && 'pointer-events-none opacity-55',
      )}
    >
      <TeamFlagImage countryName={team.name} />
      <span
        className={cn(
          'text-center font-semibold leading-tight text-foreground',
          prominent ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
        )}
      >
        {team.name}
      </span>
      <span className="sr-only">{side === 'home' ? 'Home' : 'Away'} team</span>
    </button>
  )
}

export function WinnerOnlyMatchRow({
  homeTeam,
  awayTeam,
  selected,
  onSelect,
  isLocked = false,
  isPredicted = false,
  variant = 'compact',
}: WinnerOnlyMatchRowProps) {
  const prominent = variant === 'prominent'
  const hasSelection = selected === 'home' || selected === 'away'

  function handlePick(side: 'home' | 'away') {
    if (isLocked) return
    if (selected === side) {
      onSelect(null)
      return
    }
    onSelect(side)
  }

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-border/90 bg-card/90 shadow-sm backdrop-blur-sm transition-all duration-200',
        prominent ? 'px-3 py-4' : 'px-3 py-3',
        isLocked && 'opacity-55',
        isPredicted && hasSelection && !isLocked && 'border-primary/20',
      )}
    >
      {isLocked ? (
        <div className="flex gap-2 sm:gap-3">
          <div
            className={cn(
              'flex min-h-[72px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 px-3 py-3',
              selected === 'home'
                ? 'border-primary bg-primary/10'
                : 'border-transparent opacity-50',
            )}
          >
            <TeamFlagImage countryName={homeTeam.name} />
            <span className="text-center text-sm font-semibold text-foreground">
              {homeTeam.name}
            </span>
          </div>
          <span className="self-center rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Locked
          </span>
          <div
            className={cn(
              'flex min-h-[72px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 px-3 py-3',
              selected === 'away'
                ? 'border-primary bg-primary/10'
                : 'border-transparent opacity-50',
            )}
          >
            <TeamFlagImage countryName={awayTeam.name} />
            <span className="text-center text-sm font-semibold text-foreground">
              {awayTeam.name}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 sm:gap-3">
          <WinnerTeamButton
            team={homeTeam}
            side="home"
            selected={selected === 'home'}
            dimmed={hasSelection && selected !== 'home'}
            disabled={false}
            onClick={() => handlePick('home')}
            prominent={prominent}
          />
          <WinnerTeamButton
            team={awayTeam}
            side="away"
            selected={selected === 'away'}
            dimmed={hasSelection && selected !== 'away'}
            disabled={false}
            onClick={() => handlePick('away')}
            prominent={prominent}
          />
        </div>
      )}

      {isPredicted && hasSelection && !isLocked && (
        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow-[0_0_8px_rgba(0,230,118,0.5)]">
          <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
        </div>
      )}
    </div>
  )
}
