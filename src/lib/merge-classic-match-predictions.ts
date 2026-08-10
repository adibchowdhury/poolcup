import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { isKnockoutRound } from '@/src/lib/classic-round-tab-logic'
import { isMatchLocked } from '@/src/lib/match-lock'
import { isKnockoutPredictionComplete } from '@/src/lib/knockout-match-prediction'

export type ClassicMatchRow = {
  id: string
  kickoff_at: string
  locked_at: string | null
  round: string
  group_name: string | null
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  team1_logo?: string | null
  team2_logo?: string | null
  result_team1: number | null
  result_team2: number | null
  is_final: boolean
  advancing_team: number | null
  status_short: string | null
  elapsed_minute: number | null
}

export type ClassicPredictionRow = {
  match_id: string
  pred_team1: number
  pred_team2: number
  advance_pick: number | null
  points_awarded: number | null
}

export function hasStoredClassicMatchPrediction(
  item: Pick<UserPoolPrediction, 'predTeam1' | 'predTeam2'>,
): boolean {
  return item.predTeam1 != null && item.predTeam2 != null
}

export function isClassicPredictionComplete(
  item: Pick<
    UserPoolPrediction,
    'round' | 'lockedAt' | 'predTeam1' | 'predTeam2' | 'advancePick'
  >,
): boolean {
  if (isMatchLocked(item.lockedAt)) return true
  if (!hasStoredClassicMatchPrediction(item)) return false
  if (isKnockoutRound(item.round)) {
    return isKnockoutPredictionComplete(
      item.round,
      item.predTeam1,
      item.predTeam2,
      item.advancePick,
    )
  }
  return true
}

export function mergeMatchesWithPredictions(
  matches: ClassicMatchRow[],
  predictions: ClassicPredictionRow[],
): UserPoolPrediction[] {
  const predictionByMatchId = new Map(
    predictions.map((row) => [String(row.match_id), row]),
  )

  return matches.map((match) => {
    const prediction = predictionByMatchId.get(String(match.id))

    return {
      matchId: match.id,
      kickoffAt: match.kickoff_at,
      lockedAt: match.locked_at ?? null,
      round: match.round,
      groupName: match.group_name,
      team1Name: match.team1_name,
      team2Name: match.team2_name,
      team1Flag: match.team1_flag,
      team2Flag: match.team2_flag,
      team1Logo: match.team1_logo ?? null,
      team2Logo: match.team2_logo ?? null,
      predTeam1: prediction?.pred_team1 ?? null,
      predTeam2: prediction?.pred_team2 ?? null,
      advancePick: prediction?.advance_pick ?? null,
      pointsAwarded: prediction?.points_awarded ?? null,
      advancingTeam: match.advancing_team ?? null,
      resultTeam1: match.result_team1,
      resultTeam2: match.result_team2,
      isFinal: match.is_final,
      statusShort: match.status_short ?? null,
    }
  })
}

export function allClassicPredictionsComplete(
  matches: Array<
    Pick<
      UserPoolPrediction,
      'round' | 'lockedAt' | 'predTeam1' | 'predTeam2' | 'advancePick'
    >
  >,
): boolean {
  if (matches.length === 0) return false

  return matches.every((match) => isClassicPredictionComplete(match))
}
