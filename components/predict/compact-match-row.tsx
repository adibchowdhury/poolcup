'use client'

import { Check } from 'lucide-react'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { cn } from '@/lib/utils'
import type { ResolvedTeamFlag } from '@/src/lib/team-flags'

export interface CompactTeam {
  name: string
  flag: ResolvedTeamFlag
  dbFlag?: string | null
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
  variant?: 'compact' | 'prominent'
}

function RowTeamFlag({
  countryName,
  dbFlag,
  prominent,
}: {
  countryName: string
  dbFlag?: string | null
  prominent: boolean
}) {
  return (
    <TeamFlagImage
      countryName={countryName}
      dbFlag={dbFlag}
      imgClassName={cn(
        'w-auto shrink-0 object-cover',
        prominent ? 'h-7' : 'h-6',
      )}
      emojiClassName={cn('leading-none', prominent ? 'text-xl' : 'text-lg')}
    />
  )
}

function ScoreInput({
  value,
  onChange,
  label,
  filled,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  filled: boolean
}) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'predict-score-input h-[44px] w-[44px] shrink-0 rounded-lg border text-center font-mono text-[18px] text-white outline-none transition-all duration-200',
        'bg-[#080b0f] border-[rgba(255,255,255,0.15)]',
        'focus:border-[rgba(0,230,118,0.5)] focus:shadow-[0_0_12px_rgba(0,230,118,0.2)]',
        filled && 'border-[#00e676] text-[#00e676]',
      )}
      aria-label={label}
    />
  )
}

export function CompactMatchRow({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  onHomeScoreChange,
  onAwayScoreChange,
  isLocked = false,
  isPredicted = false,
  variant = 'compact',
}: CompactMatchRowProps) {
  const filled = homeScore !== '' && awayScore !== ''
  const prominent = variant === 'prominent'

  return (
    <div
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-lg border border-border/90 bg-card/90 shadow-sm backdrop-blur-sm transition-all duration-200',
        'hover:border-primary/25 hover:bg-card hover:shadow-[0_4px_20px_rgba(0,0,0,0.25)]',
        prominent ? 'min-h-[72px] px-4 py-4' : 'min-h-[52px] px-4 py-3',
        isLocked && 'opacity-55 hover:border-border/90 hover:shadow-sm',
        isPredicted && filled && !isLocked && 'border-primary/20',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <RowTeamFlag
          countryName={homeTeam.name}
          dbFlag={homeTeam.dbFlag}
          prominent={prominent}
        />
        <span
          className={cn(
            'font-semibold text-foreground',
            prominent ? 'text-base' : 'text-sm',
          )}
        >
          {homeTeam.name}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isLocked ? (
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Locked
          </span>
        ) : (
          <>
            <ScoreInput
              value={homeScore}
              onChange={onHomeScoreChange}
              label={`${homeTeam.name} score`}
              filled={homeScore !== ''}
            />
            <span className="px-0.5 font-mono text-sm text-muted-foreground/80">–</span>
            <ScoreInput
              value={awayScore}
              onChange={onAwayScoreChange}
              label={`${awayTeam.name} score`}
              filled={awayScore !== ''}
            />
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span
          className={cn(
            'text-right font-semibold text-foreground',
            prominent ? 'text-base' : 'text-sm',
          )}
        >
          {awayTeam.name}
        </span>
        <RowTeamFlag
          countryName={awayTeam.name}
          dbFlag={awayTeam.dbFlag}
          prominent={prominent}
        />
      </div>

      {isPredicted && filled && !isLocked && (
        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow-[0_0_8px_rgba(0,230,118,0.5)]">
          <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
        </div>
      )}
    </div>
  )
}
