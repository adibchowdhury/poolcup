'use client'

import {
  CompactMatchRowTeamAway,
  CompactMatchRowTeamHome,
} from '@/components/predict/compact-match-row-teams'
import type { CompactTeam } from '@/components/predict/compact-match-row-types'
import {
  CompactMatchRowPredictedBadge,
  CompactMatchRowScoreSeparator,
  getCompactMatchRowContainerClassName,
  getCompactMatchRowScoreGroupClassName,
  PredictScoreInput,
} from '@/components/predict/predict-match-row-shared'

export type { CompactTeam } from '@/components/predict/compact-match-row-types'

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

  return (
    <div
      className={getCompactMatchRowContainerClassName({
        isLocked,
        isPredicted,
        filled,
        variant,
      })}
    >
      <CompactMatchRowTeamHome
        name={homeTeam.name}
        dbFlag={homeTeam.dbFlag}
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
        variant={variant}
      />

      <CompactMatchRowPredictedBadge
        isPredicted={isPredicted}
        filled={filled}
        isLocked={isLocked}
      />
    </div>
  )
}
