import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchMemberPredictionCounts,
  sumMemberCounts,
} from '@/src/lib/member-prediction-counts'
import { projectMatchPoints } from '@/src/lib/project-match-points'
import {
  getPredictionOutcomeLabel,
  type PredictionOutcomeKind,
} from '@/src/lib/prediction-scoring'

/** How many recently scored match picks to surface on the home Progress module. */
export const RECENT_SCORED_LIMIT = 5

export type BestPrediction =
  | {
      kind: 'match'
      points: number
      label: string
      team1Name: string
      team2Name: string
      predTeam1: number
      predTeam2: number
      resultTeam1: number
      resultTeam2: number
      summary: string
    }
  | {
      kind: 'group'
      points: number
      groupName: string
      summary: string
    }
  | {
      kind: 'third_place'
      points: number
      summary: string
    }

/** Settled match prediction for the home "Recent results" list (most recent first). */
export type RecentScoredPrediction = {
  matchId: string
  team1Name: string
  team2Name: string
  predTeam1: number
  predTeam2: number
  resultTeam1: number
  resultTeam2: number
  points: number
  outcomeKind: PredictionOutcomeKind
  outcomeLabel: string
  kickoffAt: string
}

export type RecentResultsFeedData = {
  totalPoints: number
  winRate: number | null
  /** Consecutive settled matches with at least one positive-scoring pick. */
  currentStreak: number
  bestPrediction: BestPrediction | null
  /** Chronological settled match picks (most recent kickoff first). */
  recentScored: RecentScoredPrediction[]
  /** True when the user has no points or settled prediction activity. */
  isEmpty: boolean
  error: string | null
}

type MembershipRow = {
  id: string
  pools: { scoring_style: string } | { scoring_style: string }[] | null
}

type MatchJoin = {
  team1_name: string
  team2_name: string
  result_team1: number | null
  result_team2: number | null
  round: string
  group_name: string | null
  is_final: boolean
  advancing_team: number | null
  kickoff_at?: string
}

type PredictionBestRow = {
  points_awarded: number
  pred_team1: number
  pred_team2: number
  advance_pick: number | null
  match_id?: string
  matches: MatchJoin | MatchJoin[] | null
}

type StreakMatchJoin = {
  kickoff_at: string
  is_final: boolean
}

type StreakPredictionRow = {
  match_id: string
  points_awarded: number
  matches: StreakMatchJoin | StreakMatchJoin[] | null
}

function unwrapPool(row: MembershipRow) {
  const raw = row.pools
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function unwrapMatch(raw: MatchJoin | MatchJoin[] | null): MatchJoin | null {
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function unwrapStreakMatch(
  raw: StreakMatchJoin | StreakMatchJoin[] | null,
): StreakMatchJoin | null {
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

/**
 * Current momentum across real settled fixtures. Multiple pool predictions for
 * the same match count once; a match is successful when any pick scored points.
 */
function calculateCurrentStreak(rows: StreakPredictionRow[]): number {
  const byMatch = new Map<
    string,
    { kickoffMs: number; scored: boolean }
  >()

  for (const row of rows) {
    const match = unwrapStreakMatch(row.matches)
    if (!match?.is_final) continue
    const kickoffMs = new Date(match.kickoff_at).getTime()
    if (!Number.isFinite(kickoffMs)) continue

    const existing = byMatch.get(row.match_id)
    byMatch.set(row.match_id, {
      kickoffMs,
      scored: (existing?.scored ?? false) || row.points_awarded > 0,
    })
  }

  const settled = [...byMatch.values()].sort(
    (a, b) => b.kickoffMs - a.kickoffMs,
  )

  let streak = 0
  for (const match of settled) {
    if (!match.scored) break
    streak += 1
  }
  return streak
}

function buildMatchBestPrediction(row: PredictionBestRow): BestPrediction | null {
  const match = unwrapMatch(row.matches)
  if (!match) return null
  if (match.result_team1 == null || match.result_team2 == null) return null

  const projection = projectMatchPoints(
    match.round,
    row.pred_team1,
    row.pred_team2,
    row.advance_pick,
    match.result_team1,
    match.result_team2,
    match.advancing_team,
  )
  const label = getPredictionOutcomeLabel(projection.kind)

  return {
    kind: 'match',
    points: row.points_awarded,
    label,
    team1Name: match.team1_name,
    team2Name: match.team2_name,
    predTeam1: row.pred_team1,
    predTeam2: row.pred_team2,
    resultTeam1: match.result_team1,
    resultTeam2: match.result_team2,
    summary: `${label}: ${match.team1_name} ${match.result_team1}–${match.result_team2} ${match.team2_name}, +${row.points_awarded} pts`,
  }
}

function buildRecentScoredPrediction(
  row: PredictionBestRow,
): RecentScoredPrediction | null {
  const matchId = typeof row.match_id === 'string' ? row.match_id : ''
  const match = unwrapMatch(row.matches)
  if (!matchId || !match) return null
  if (match.result_team1 == null || match.result_team2 == null) return null
  if (!match.is_final) return null

  const kickoffAt = match.kickoff_at ?? ''
  const kickoffMs = kickoffAt ? new Date(kickoffAt).getTime() : NaN
  if (!Number.isFinite(kickoffMs)) return null

  const projection = projectMatchPoints(
    match.round,
    row.pred_team1,
    row.pred_team2,
    row.advance_pick,
    match.result_team1,
    match.result_team2,
    match.advancing_team,
  )

  return {
    matchId,
    team1Name: match.team1_name,
    team2Name: match.team2_name,
    predTeam1: row.pred_team1,
    predTeam2: row.pred_team2,
    resultTeam1: match.result_team1,
    resultTeam2: match.result_team2,
    points: row.points_awarded,
    outcomeKind: projection.kind,
    outcomeLabel: getPredictionOutcomeLabel(projection.kind),
    kickoffAt,
  }
}

/**
 * Dedupe multi-pool picks for the same match (keep highest points), then
 * take the newest RECENT_SCORED_LIMIT by kickoff.
 */
function buildRecentScoredList(
  rows: PredictionBestRow[],
): RecentScoredPrediction[] {
  const byMatch = new Map<string, RecentScoredPrediction>()

  for (const row of rows) {
    const item = buildRecentScoredPrediction(row)
    if (!item) continue
    const existing = byMatch.get(item.matchId)
    if (!existing || item.points > existing.points) {
      byMatch.set(item.matchId, item)
    }
  }

  return [...byMatch.values()]
    .sort(
      (a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    )
    .slice(0, RECENT_SCORED_LIMIT)
}

export async function fetchRecentResultsFeed(
  supabase: SupabaseClient,
  userId: string,
): Promise<RecentResultsFeedData> {
  const empty: RecentResultsFeedData = {
    totalPoints: 0,
    winRate: null,
    currentStreak: 0,
    bestPrediction: null,
    recentScored: [],
    isEmpty: true,
    error: null,
  }

  try {
    const [
      userResult,
      membershipsResult,
    ] = await Promise.all([
      supabase
        .from('users')
        .select('points')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('pool_members')
        .select('id, pools(scoring_style)')
        .eq('user_id', userId),
    ])

    if (userResult.error) {
      return { ...empty, error: userResult.error.message }
    }
    if (membershipsResult.error) {
      return { ...empty, error: membershipsResult.error.message }
    }

    const totalPoints = Number(userResult.data?.points ?? 0)

    const memberships = (membershipsResult.data ?? []) as MembershipRow[]
    const memberContexts = memberships.flatMap((row) => {
      const pool = unwrapPool(row)
      if (!pool) return []
      return [{ memberId: row.id, scoringStyle: pool.scoring_style }]
    })
    const memberIds = memberContexts.map((row) => row.memberId)

    let winRate: number | null = null
    let currentStreak = 0
    let bestPrediction: BestPrediction | null = null
    let recentScored: RecentScoredPrediction[] = []

    if (memberIds.length > 0) {
      const [
        counts,
        cacheResult,
        streakResult,
        bestMatchResult,
        bestGroupResult,
        bestThirdResult,
        recentMatchResult,
      ] = await Promise.all([
        fetchMemberPredictionCounts(supabase, memberContexts),
        supabase
          .from('leaderboard_cache')
          .select('member_id, correct_winners')
          .in('member_id', memberIds),
        supabase
          .from('predictions')
          .select(
            `
            match_id,
            points_awarded,
            matches!inner (
              kickoff_at,
              is_final
            )
          `,
          )
          .in('member_id', memberIds),
        supabase
          .from('predictions')
          .select(
            `
            points_awarded,
            pred_team1,
            pred_team2,
            advance_pick,
            match_id,
            matches!inner (
              team1_name,
              team2_name,
              result_team1,
              result_team2,
              round,
              group_name,
              is_final,
              advancing_team
            )
          `,
          )
          .in('member_id', memberIds)
          .gt('points_awarded', 0)
          .order('points_awarded', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('group_predictions')
          .select('points_awarded, group_name')
          .in('member_id', memberIds)
          .gt('points_awarded', 0)
          .order('points_awarded', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('third_place_rankings')
          .select('points_awarded')
          .eq('user_id', userId)
          .gt('points_awarded', 0)
          .order('points_awarded', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('predictions')
          .select(
            `
            points_awarded,
            pred_team1,
            pred_team2,
            advance_pick,
            match_id,
            matches!inner (
              team1_name,
              team2_name,
              result_team1,
              result_team2,
              round,
              group_name,
              is_final,
              advancing_team,
              kickoff_at
            )
          `,
          )
          .in('member_id', memberIds)
          .eq('matches.is_final', true)
          .not('matches.result_team1', 'is', null)
          .not('matches.result_team2', 'is', null)
          .order('kickoff_at', {
            ascending: false,
            foreignTable: 'matches',
          })
          .limit(RECENT_SCORED_LIMIT * 4),
      ])

      if (cacheResult.error) {
        return { ...empty, error: cacheResult.error.message }
      }
      if (streakResult.error) {
        return { ...empty, error: streakResult.error.message }
      }

      const correctByMember = new Map<string, number>()
      for (const row of cacheResult.data ?? []) {
        correctByMember.set(row.member_id, row.correct_winners ?? 0)
      }

      const correctPredictions = sumMemberCounts(memberIds, correctByMember)
      const settledPredictions = sumMemberCounts(
        memberIds,
        counts.classicMatchPredictionsByMember,
      )
      winRate =
        settledPredictions > 0
          ? Math.round((correctPredictions / settledPredictions) * 100)
          : null

      currentStreak = calculateCurrentStreak(
        (streakResult.data ?? []) as StreakPredictionRow[],
      )

      const candidates: BestPrediction[] = []

      if (!bestMatchResult.error && bestMatchResult.data) {
        const matchBest = buildMatchBestPrediction(
          bestMatchResult.data as PredictionBestRow,
        )
        if (matchBest) candidates.push(matchBest)
      }

      if (!bestGroupResult.error && bestGroupResult.data) {
        const pts = bestGroupResult.data.points_awarded as number
        const groupName = String(bestGroupResult.data.group_name ?? '')
        candidates.push({
          kind: 'group',
          points: pts,
          groupName,
          summary: `Group ${groupName} standings, +${pts} pts`,
        })
      }

      if (!bestThirdResult.error && bestThirdResult.data) {
        const pts = bestThirdResult.data.points_awarded as number
        candidates.push({
          kind: 'third_place',
          points: pts,
          summary: `Third-place ranking, +${pts} pts`,
        })
      }

      if (candidates.length > 0) {
        bestPrediction = candidates.reduce((best, row) =>
          row.points > best.points ? row : best,
        )
      }

      if (!recentMatchResult.error && recentMatchResult.data) {
        recentScored = buildRecentScoredList(
          recentMatchResult.data as PredictionBestRow[],
        )
      }
    }

    const isEmpty =
      totalPoints <= 0 &&
      bestPrediction == null &&
      recentScored.length === 0 &&
      winRate == null &&
      currentStreak === 0

    return {
      totalPoints,
      winRate,
      currentStreak,
      bestPrediction,
      recentScored,
      isEmpty,
      error: null,
    }
  } catch (err) {
    return {
      ...empty,
      error:
        err instanceof Error ? err.message : 'Failed to load recent results',
    }
  }
}
