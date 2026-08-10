'use client'

import {
  CompactMatchRowTeamAway,
  CompactMatchRowTeamHome,
} from '@/components/predict/compact-match-row-teams'
import type { CompactTeam } from '@/components/predict/compact-match-row-types'
import {
  CompactMatchRowKickoffTime,
  CompactMatchRowPredictedBadge,
  CompactMatchRowScoreSeparator,
  getCompactMatchRowContainerClassName,
  getCompactMatchRowScoreGroupClassName,
  getCompactMatchRowTeamsRowClassName,
  PredictScoreInput,
} from '@/components/predict/predict-match-row-shared'

export type { CompactTeam } from '@/components/predict/compact-match-row-types'

export interface CompactMatchRowProps {
  homeTeam: CompactTeam
  awayTeam: CompactTeam
  homeScore: string
  awayScore: string
  kickoffAt?: string
  statusNote?: string | null
  onHomeScoreChange: (value: string) => void
  onAwayScoreChange: (value: string) => void
  isLocked?: boolean
  isPredicted?: boolean
  variant?: 'compact' | 'prominent'
}

export function CompactMatchRow({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  kickoffAt,
  statusNote = null,
  onHomeScoreChange,
  onAwayScoreChange,
  isLocked = false,
  isPredicted = false,
  variant = 'compact',
}: CompactMatchRowProps) {
  const filled = homeScore !== '' && awayScore !== ''

  return (
    <div
      className={getCompactMatchRowContainerClassName({
        isLocked,
        isPredicted,
        filled,
        variant,
      })}
    >
      {statusNote || kickoffAt ? (
        <div className="flex w-full justify-end pr-4">
          {statusNote ? (
            <span className="shrink-0 text-[10px] font-semibold text-muted-foreground sm:text-xs">
              {statusNote}
            </span>
          ) : kickoffAt ? (
            <CompactMatchRowKickoffTime
              kickoffAt={kickoffAt}
              isLocked={isLocked}
            />
          ) : null}
        </div>
      ) : null}

      <div className={getCompactMatchRowTeamsRowClassName()}>
        <CompactMatchRowTeamHome
          name={homeTeam.name}
          dbFlag={homeTeam.dbFlag}
          logoUrl={homeTeam.logoUrl}
          variant={variant}
        />

        <div className={getCompactMatchRowScoreGroupClassName()}>
          {isLocked ? (
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Locked
            </span>
          ) : (
            <>
              <PredictScoreInput
                value={homeScore}
                onChange={onHomeScoreChange}
                label={`${homeTeam.name} score`}
                filled={homeScore !== ''}
              />
              <CompactMatchRowScoreSeparator />
              <PredictScoreInput
                value={awayScore}
                onChange={onAwayScoreChange}
                label={`${awayTeam.name} score`}
                filled={awayScore !== ''}
              />
            </>
          )}
        </div>

        <CompactMatchRowTeamAway
          name={awayTeam.name}
          dbFlag={awayTeam.dbFlag}
          logoUrl={awayTeam.logoUrl}
          variant={variant}
        />
      </div>

      <CompactMatchRowPredictedBadge
        isPredicted={isPredicted}
        filled={filled}
        isLocked={isLocked}
      />
    </div>
  )
}
