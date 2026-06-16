import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { isMatchLocked } from '@/src/lib/match-lock'

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
  result_team1: number | null
  result_team2: number | null
  is_final: boolean
}

export type ClassicPredictionRow = {
  match_id: string
  pred_team1: number
  pred_team2: number
}

export function hasStoredClassicMatchPrediction(
  item: Pick<UserPoolPrediction, 'predTeam1' | 'predTeam2'>,
): boolean {
  return item.predTeam1 != null && item.predTeam2 != null
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
      predTeam1: prediction?.pred_team1 ?? null,
      predTeam2: prediction?.pred_team2 ?? null,
      resultTeam1: match.result_team1,
      resultTeam2: match.result_team2,
      isFinal: match.is_final,
    }
  })
}

export function allClassicPredictionsComplete(
  matches: Array<Pick<UserPoolPrediction, 'lockedAt' | 'predTeam1' | 'predTeam2'>>,
): boolean {
  if (matches.length === 0) return false

  return matches.every((match) => {
    if (isMatchLocked(match.lockedAt)) return true
    return hasStoredClassicMatchPrediction(match)
  })
}
