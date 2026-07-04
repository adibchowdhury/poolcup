import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import {
  mergeMatchesWithPredictions,
  type ClassicMatchRow,
  type ClassicPredictionRow,
} from '@/src/lib/merge-classic-match-predictions'

export type ClassicPredictionsMobileData = {
  predictions: UserPoolPrediction[]
  totalMatchCount: number
  error: string | null
}

/** READ-ONLY: loads matches + member predictions (same queries as pool page). */
export async function fetchClassicPredictionsMobile(
  supabase: SupabaseClient,
  poolId: string,
  memberId: string,
): Promise<ClassicPredictionsMobileData> {
  const [matchesResult, userPredResult, countResult] = await Promise.all([
    supabase
      .from('matches')
      .select(
        'id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, group_name, round, result_team1, result_team2, is_final, advancing_team, status_short, elapsed_minute',
      )
      .order('kickoff_at', { ascending: true }),
    supabase
      .from('predictions')
      .select('match_id, pred_team1, pred_team2, advance_pick, points_awarded')
      .eq('pool_id', poolId)
      .eq('member_id', memberId),
    supabase.from('matches').select('*', { count: 'exact', head: true }),
  ])

  if (matchesResult.error) {
    return {
      predictions: [],
      totalMatchCount: 0,
      error: 'Could not load matches.',
    }
  }

  if (userPredResult.error) {
    return {
      predictions: [],
      totalMatchCount: countResult.count ?? 0,
      error: 'Could not load your predictions.',
    }
  }

  const matchRows = (matchesResult.data ?? []) as ClassicMatchRow[]
  const predictionRows = (userPredResult.data ?? []) as ClassicPredictionRow[]

  return {
    predictions: mergeMatchesWithPredictions(matchRows, predictionRows),
    totalMatchCount: countResult.count ?? matchRows.length,
    error: null,
  }
}
