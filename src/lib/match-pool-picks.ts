import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getPredictionOutcome,
  type MatchScoringStyle,
} from '@/src/lib/prediction-scoring'

export type MatchPoolPick = {
  memberId: string
  displayName: string
  userId: string
  predTeam1: number
  predTeam2: number
  advancePick: number | null
  points: number | null
}

type PredictionRow = {
  pred_team1: number
  pred_team2: number
  advance_pick: number | null
  member_id: string
  pool_members:
    | { display_name: string; user_id: string }
    | { display_name: string; user_id: string }[]
    | null
}

function resolvePoints(
  isFinal: boolean,
  resultTeam1: number | null,
  resultTeam2: number | null,
  predTeam1: number,
  predTeam2: number,
  scoringStyle: MatchScoringStyle,
): number | null {
  if (
    !isFinal ||
    resultTeam1 == null ||
    resultTeam2 == null
  ) {
    return null
  }

  return getPredictionOutcome(
    predTeam1,
    predTeam2,
    resultTeam1,
    resultTeam2,
    scoringStyle,
  ).points
}

function sortPicks(picks: MatchPoolPick[], isFinal: boolean): MatchPoolPick[] {
  return [...picks].sort((a, b) => {
    if (isFinal) {
      const pointsA = a.points ?? 0
      const pointsB = b.points ?? 0
      if (pointsB !== pointsA) return pointsB - pointsA
    }
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: 'base',
    })
  })
}

export async function fetchMatchPoolPicks(
  supabase: SupabaseClient,
  poolId: string,
  matchId: string,
  {
    isFinal,
    resultTeam1,
    resultTeam2,
    scoringStyle,
  }: {
    isFinal: boolean
    resultTeam1: number | null
    resultTeam2: number | null
    scoringStyle: MatchScoringStyle
  },
): Promise<{ picks: MatchPoolPick[]; error: string | null }> {
  const { data, error } = await supabase
    .from('predictions')
    .select(
      `
      pred_team1,
      pred_team2,
      advance_pick,
      member_id,
      pool_members!inner (
        display_name,
        user_id
      )
    `,
    )
    .eq('pool_id', poolId)
    .eq('match_id', matchId)

  if (error) {
    return { picks: [], error: error.message }
  }

  const picks: MatchPoolPick[] = []

  for (const row of (data ?? []) as PredictionRow[]) {
    const memberRaw = row.pool_members
    const member = Array.isArray(memberRaw) ? memberRaw[0] : memberRaw
    if (!member) continue

    picks.push({
      memberId: row.member_id,
      displayName: member.display_name,
      userId: member.user_id,
      predTeam1: row.pred_team1,
      predTeam2: row.pred_team2,
      advancePick: row.advance_pick,
      points: resolvePoints(
        isFinal,
        resultTeam1,
        resultTeam2,
        row.pred_team1,
        row.pred_team2,
        scoringStyle,
      ),
    })
  }

  return { picks: sortPicks(picks, isFinal), error: null }
}
