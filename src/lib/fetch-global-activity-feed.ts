import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveCurrentEventId } from '@/src/lib/current-event'
import { isMatchLocked } from '@/src/lib/match-lock'
import {
  buildOutcomeRows,
  getConsensusConfidenceLabel,
  getDominantOutcome,
  type OutcomeRow,
} from '@/src/lib/match-prediction-consensus'
import {
  parseMatchPredictionDistribution,
  type MatchPredictionDistribution,
} from '@/src/lib/match-prediction-distribution'

/** Cap closest-call distribution RPC fan-out (locked matches only). */
const LOCKED_MATCH_SAMPLE_LIMIT = 8
const MIN_PREDICTIONS_FOR_CLOSEST_CALL = 3

export type GlobalActivityMatch = {
  id: string
  team1Name: string
  team2Name: string
  team1Flag: string | null
  team2Flag: string | null
  team1Logo: string | null
  team2Logo: string | null
  resultTeam1: number | null
  resultTeam2: number | null
  kickoffAt: string
  lockedAt: string | null
  round: string
  groupName: string | null
  isFinal: boolean
  /** True when locked_at has passed — consensus % available. */
  isLocked: boolean
  /** Global prediction count from get_most_predicted_matches (or distribution.total). */
  totalPredictions: number
  distribution: MatchPredictionDistribution | null
  outcomeRows: OutcomeRow[]
  dominant: OutcomeRow | null
  confidenceLabel: string | null
  topScoreline: { team1: number; team2: number; count: number } | null
}

export type ClosestCallActivity = {
  match: GlobalActivityMatch
  /** Highest outcome share 0–1 (lower = more split). */
  maxShare: number
}

/** Anonymized community climb — no person names. */
export type BiggestCommunityClimb = {
  poolName: string
  rank: number
  prevRank: number
  rankDelta: number
}

export type GlobalActivityFeedData = {
  /** Genuinely most-predicted match across all matches (global RPC). */
  mostPredicted: GlobalActivityMatch | null
  /** Most evenly split crowd among recent locked matches. */
  closestCall: ClosestCallActivity | null
  /** Community-wide biggest climb (anonymized). */
  biggestCommunityClimb: BiggestCommunityClimb | null
  isEmpty: boolean
  error: string | null
}

type MatchRow = {
  id: string
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  team1_logo: string | null
  team2_logo: string | null
  result_team1: number | null
  result_team2: number | null
  kickoff_at: string
  locked_at: string | null
  round: string
  group_name: string | null
  is_final: boolean
}

type MostPredictedRpcRow = {
  match_id: string
  prediction_count: number | string
}

type BiggestClimbRpcRow = {
  pool_name: string
  rank: number
  prev_rank: number
  rank_delta: number
}

const MATCH_COLUMNS =
  'id, team1_name, team2_name, team1_flag, team2_flag, team1_logo, team2_logo, result_team1, result_team2, kickoff_at, locked_at, round, group_name, is_final'

function toActivityMatch(
  row: MatchRow,
  totalPredictions: number,
  distribution: MatchPredictionDistribution | null,
): GlobalActivityMatch {
  const locked = isMatchLocked(row.locked_at)
  const outcomeRows =
    distribution != null
      ? buildOutcomeRows(
          distribution.outcomes,
          row.team1_name,
          row.team2_name,
          distribution.total,
        )
      : []
  const dominant = getDominantOutcome(outcomeRows)
  const maxShare =
    distribution != null && distribution.total > 0 && dominant
      ? dominant.count / distribution.total
      : 0

  return {
    id: row.id,
    team1Name: row.team1_name,
    team2Name: row.team2_name,
    team1Flag: row.team1_flag,
    team2Flag: row.team2_flag,
    team1Logo: row.team1_logo ?? null,
    team2Logo: row.team2_logo ?? null,
    resultTeam1: row.result_team1,
    resultTeam2: row.result_team2,
    kickoffAt: row.kickoff_at,
    lockedAt: row.locked_at,
    round: row.round,
    groupName: row.group_name,
    isFinal: row.is_final,
    isLocked: locked,
    totalPredictions,
    distribution,
    outcomeRows,
    dominant,
    confidenceLabel:
      distribution != null ? getConsensusConfidenceLabel(maxShare) : null,
    topScoreline: distribution?.top_scores[0] ?? null,
  }
}

async function fetchDistributionForMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchPredictionDistribution | null> {
  const { data, error } = await supabase.rpc(
    'get_match_prediction_distribution',
    {
      p_match_id: matchId,
      p_pool_id: null,
    },
  )

  if (error) {
    console.error(
      `Failed to load distribution for match ${matchId}:`,
      error.message,
    )
    return null
  }

  return parseMatchPredictionDistribution(data)
}

async function fetchMostPredictedMatch(
  supabase: SupabaseClient,
): Promise<{ match: GlobalActivityMatch | null; error: string | null }> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    'get_most_predicted_matches',
    {
      p_match_ids: null,
      p_limit: 1,
    },
  )

  if (rpcError) {
    return { match: null, error: rpcError.message }
  }

  const top = ((rpcRows ?? []) as MostPredictedRpcRow[])[0]
  if (!top?.match_id) {
    return { match: null, error: null }
  }

  const predictionCount = Number(top.prediction_count)
  if (!Number.isFinite(predictionCount) || predictionCount <= 0) {
    return { match: null, error: null }
  }

  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .select(MATCH_COLUMNS)
    .eq('id', top.match_id)
    .maybeSingle()

  if (matchError) {
    return { match: null, error: matchError.message }
  }
  if (!matchRow) {
    return { match: null, error: null }
  }

  const row = matchRow as MatchRow
  const locked = isMatchLocked(row.locked_at)
  const distribution = locked
    ? await fetchDistributionForMatch(supabase, row.id)
    : null

  return {
    match: toActivityMatch(row, predictionCount, distribution),
    error: null,
  }
}

async function fetchBiggestCommunityClimb(
  supabase: SupabaseClient,
): Promise<{ climb: BiggestCommunityClimb | null; error: string | null }> {
  const { data, error } = await supabase.rpc(
    'get_biggest_leaderboard_movements',
    { p_limit: 1 },
  )

  if (error) {
    return { climb: null, error: error.message }
  }

  const row = ((data ?? []) as BiggestClimbRpcRow[])[0]
  if (!row || row.rank_delta <= 0) {
    return { climb: null, error: null }
  }

  return {
    climb: {
      poolName: row.pool_name,
      rank: row.rank,
      prevRank: row.prev_rank,
      rankDelta: row.rank_delta,
    },
    error: null,
  }
}

async function fetchClosestCall(
  supabase: SupabaseClient,
): Promise<{ closestCall: ClosestCallActivity | null; error: string | null }> {
  const nowIso = new Date().toISOString()
  const eventId = await resolveCurrentEventId(supabase)

  let query = supabase
    .from('matches')
    .select(MATCH_COLUMNS)
    .not('locked_at', 'is', null)
    .lte('locked_at', nowIso)
    .order('kickoff_at', { ascending: false })
    .limit(LOCKED_MATCH_SAMPLE_LIMIT)
  if (eventId) query = query.eq('event_id', eventId)

  const { data, error } = await query

  if (error) {
    return { closestCall: null, error: error.message }
  }

  const lockedRows = ((data ?? []) as MatchRow[]).filter((row) =>
    isMatchLocked(row.locked_at),
  )

  const distributions = await Promise.all(
    lockedRows.map(async (row) => {
      const distribution = await fetchDistributionForMatch(supabase, row.id)
      return { row, distribution }
    }),
  )

  let closestCall: ClosestCallActivity | null = null

  for (const { row, distribution } of distributions) {
    if (
      distribution == null ||
      distribution.total < MIN_PREDICTIONS_FOR_CLOSEST_CALL
    ) {
      continue
    }

    const match = toActivityMatch(row, distribution.total, distribution)
    const dominant = match.dominant
    if (!dominant || match.totalPredictions <= 0) continue

    const maxShare = dominant.count / match.totalPredictions
    if (!closestCall || maxShare < closestCall.maxShare) {
      closestCall = { match, maxShare }
    }
  }

  return { closestCall, error: null }
}

export async function fetchGlobalActivityFeed(
  supabase: SupabaseClient,
  _userId: string,
): Promise<GlobalActivityFeedData> {
  const empty: GlobalActivityFeedData = {
    mostPredicted: null,
    closestCall: null,
    biggestCommunityClimb: null,
    isEmpty: true,
    error: null,
  }

  try {
    const [mostPredictedResult, climbResult, closestResult] = await Promise.all(
      [
        fetchMostPredictedMatch(supabase),
        fetchBiggestCommunityClimb(supabase),
        fetchClosestCall(supabase),
      ],
    )

    const errors = [
      mostPredictedResult.error,
      climbResult.error,
      closestResult.error,
    ].filter(Boolean)

    const mostPredicted = mostPredictedResult.match
    const biggestCommunityClimb = climbResult.climb
    const closestCall = closestResult.closestCall

    const isEmpty =
      mostPredicted == null &&
      closestCall == null &&
      biggestCommunityClimb == null

    return {
      mostPredicted,
      closestCall,
      biggestCommunityClimb,
      isEmpty,
      error: errors.length > 0 ? errors.join(' · ') : null,
    }
  } catch (err) {
    return {
      ...empty,
      error:
        err instanceof Error
          ? err.message
          : 'Failed to load global PoolCup activity',
    }
  }
}
