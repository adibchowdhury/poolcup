import type { SupabaseClient } from '@supabase/supabase-js'

export type MyMatchPredictionPick = {
  team1: number
  team2: number
  pool_count: number
}

export type MyMatchPredictions = {
  has_prediction: boolean
  pool_count: number
  distinct_count: number
  picks: MyMatchPredictionPick[]
}

const EMPTY_MY_MATCH_PREDICTIONS: MyMatchPredictions = {
  has_prediction: false,
  pool_count: 0,
  distinct_count: 0,
  picks: [],
}

function parsePick(item: unknown): MyMatchPredictionPick | null {
  if (!item || typeof item !== 'object') return null

  const row = item as Record<string, unknown>
  const team1 = row.team1
  const team2 = row.team2
  const poolCount = row.pool_count ?? row.poolCount

  if (
    typeof team1 !== 'number' ||
    typeof team2 !== 'number' ||
    typeof poolCount !== 'number'
  ) {
    return null
  }

  return { team1, team2, pool_count: poolCount }
}

export function parseMyMatchPredictions(data: unknown): MyMatchPredictions | null {
  if (!data || typeof data !== 'object') return null

  const row = data as Record<string, unknown>
  const hasPrediction = row.has_prediction ?? row.hasPrediction
  const poolCount = row.pool_count ?? row.poolCount
  const distinctCount = row.distinct_count ?? row.distinctCount
  const picksRaw = row.picks

  if (typeof hasPrediction !== 'boolean') return null
  if (typeof poolCount !== 'number' || typeof distinctCount !== 'number') {
    return null
  }

  const picks = Array.isArray(picksRaw)
    ? picksRaw
        .map(parsePick)
        .filter((pick): pick is MyMatchPredictionPick => pick != null)
    : []

  return {
    has_prediction: hasPrediction,
    pool_count: poolCount,
    distinct_count: distinctCount,
    picks,
  }
}

export async function fetchMyMatchPredictions(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MyMatchPredictions | null> {
  const { data, error } = await supabase.rpc('get_my_match_predictions', {
    p_match_id: matchId,
  })

  if (error) {
    console.error('Failed to load my match predictions:', error.message)
    return null
  }

  return parseMyMatchPredictions(data)
}

export { EMPTY_MY_MATCH_PREDICTIONS }
