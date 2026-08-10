'use client'

import { KNOCKOUT_TAB_INTRO } from '@/components/predict/knockout-bracket-tab'
import {
  PredictionMatchCard,
  type UserPoolPrediction,
} from '@/components/pool/prediction-match-card'
import { ROUND_OF_32_PREVIEW } from '@/src/lib/round-of-32-preview-schedule'

function toPreviewPrediction(entry: (typeof ROUND_OF_32_PREVIEW)[number]): UserPoolPrediction {
  return {
    matchId: `preview-r32-${entry.no}`,
    kickoffAt: entry.kickoff,
    lockedAt: null,
    round: 'r32',
    groupName: null,
    team1Name: 'TBD',
    team2Name: 'TBD',
    team1Flag: null,
    team2Flag: null,
    team1Logo: null,
    team2Logo: null,
    predTeam1: null,
    predTeam2: null,
    advancePick: null,
    pointsAwarded: null,
    advancingTeam: null,
    resultTeam1: null,
    resultTeam2: null,
    isFinal: false,
    statusShort: null,
  }
}

export function ClassicR32PreviewTab() {
  return (
    <div className="space-y-4">
      <p className="mx-auto max-w-2xl px-4 text-center text-sm text-muted-foreground">
        {KNOCKOUT_TAB_INTRO.r32}
      </p>
      <ul className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2">
        {ROUND_OF_32_PREVIEW.map((entry) => (
          <li key={entry.no} className="min-w-0">
            <PredictionMatchCard
              preview
              prediction={toPreviewPrediction(entry)}
              previewSlotLabel={entry.slot}
              previewVenue={entry.venue}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
