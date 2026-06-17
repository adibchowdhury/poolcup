'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompactMatchRow, type CompactTeam } from './compact-match-row'
import {
  WinnerOnlyMatchRow,
  type WinnerPick,
} from './winner-only-match-row'

export interface SectionMatch {
  id: string
  homeTeam: CompactTeam
  awayTeam: CompactTeam
  homeScore: string
  awayScore: string
  kickoffAt: string
  winnerPick?: WinnerPick
  isLocked?: boolean
  isPredicted?: boolean
}

interface MatchSectionProps {
  id: string
  title: string
  subtitle?: string
  matches: SectionMatch[]
  predictedInSection: number
  defaultOpen?: boolean
  winnerOnly?: boolean
  onHomeScoreChange: (matchId: string, value: string) => void
  onAwayScoreChange: (matchId: string, value: string) => void
  onWinnerPickChange?: (matchId: string, pick: WinnerPick) => void
}

export function MatchSection({
  id,
  title,
  subtitle,
  matches,
  predictedInSection,
  defaultOpen = false,
  winnerOnly = false,
  onHomeScoreChange,
  onAwayScoreChange,
  onWinnerPickChange,
}: MatchSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (matches.length === 0) return null

  return (
    <section
      id={id}
      className="overflow-hidden rounded-xl border border-border/90 bg-card/40"
    >
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30 sm:px-4 sm:py-3"
      >
        <div className="min-w-0 text-left">
          <h3 className="font-display text-lg tracking-wide text-foreground uppercase sm:text-xl">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="whitespace-nowrap rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary sm:text-xs">
            {predictedInSection}/{matches.length}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-300 ease-out',
              isOpen && 'rotate-180',
            )}
          />
        </div>
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 border-t border-border/60 p-3 sm:p-4">
            {matches.map((match) =>
              winnerOnly && onWinnerPickChange ? (
                <WinnerOnlyMatchRow
                  key={match.id}
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                  selected={match.winnerPick ?? null}
                  isLocked={match.isLocked}
                  isPredicted={match.isPredicted}
                  onSelect={(pick) => onWinnerPickChange(match.id, pick)}
                />
              ) : (
                <CompactMatchRow
                  key={match.id}
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                  homeScore={match.homeScore}
                  awayScore={match.awayScore}
                  kickoffAt={match.kickoffAt}
                  isLocked={match.isLocked}
                  isPredicted={match.isPredicted}
                  onHomeScoreChange={(v) => onHomeScoreChange(match.id, v)}
                  onAwayScoreChange={(v) => onAwayScoreChange(match.id, v)}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
