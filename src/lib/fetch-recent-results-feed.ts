import type { SupabaseClient } from '@supabase/supabase-js'
import type { RankMovement } from '@/components/dashboard/pool-card'
import { fetchDashboardPools } from '@/src/lib/fetch-dashboard-pools'
import {
  fetchMemberPredictionCounts,
  sumMemberCounts,
} from '@/src/lib/member-prediction-counts'
import {
  formatRelativeTimestamp,
  getPointsTransactionDescription,
  type PointsTransactionRow,
} from '@/src/lib/points-transaction-feed'
import { projectMatchPoints } from '@/src/lib/project-match-points'
import { getPredictionOutcomeLabel } from '@/src/lib/prediction-scoring'

const RECENT_TRANSACTION_FETCH_LIMIT = 40
const RECENT_SCORING_EVENT_LIMIT = 8

/** Scoring-related reasons (excludes signup / referral / pool_created). */
const SCORING_REASONS = new Set([
  'correct_winner',
  'exact_score',
  'correct_draw',
  'correct_advance',
  'exact_score_and_advance',
  'winner_group',
  'third_place',
])

export type RecentPointsEvent = {
  id: string
  reason: string
  description: string
  points: number
  createdAt: string
  relativeTime: string
}

export type RecentRankChange = {
  poolId: string
  poolName: string
  inviteCode: string
  yourRank: number | null
  movement: RankMovement
  rankDelta: number
}

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

export type RecentResultsFeedData = {
  recentPointsTotal: number
  recentEvents: RecentPointsEvent[]
  winRate: number | null
  correctPredictions: number
  settledPredictions: number
  rankChanges: RecentRankChange[]
  bestPrediction: BestPrediction | null
  /** True when the user has no scored activity to show. */
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
}

type PredictionBestRow = {
  points_awarded: number
  pred_team1: number
  pred_team2: number
  advance_pick: number | null
  matches: MatchJoin | MatchJoin[] | null
}

function unwrapPool(row: MembershipRow) {
  const raw = row.pools
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function unwrapMatch(raw: MatchJoin | MatchJoin[] | null): MatchJoin | null {
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function isScoringReason(reason: string): boolean {
  return SCORING_REASONS.has(reason)
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

export async function fetchRecentResultsFeed(
  supabase: SupabaseClient,
  userId: string,
): Promise<RecentResultsFeedData> {
  const empty: RecentResultsFeedData = {
    recentPointsTotal: 0,
    recentEvents: [],
    winRate: null,
    correctPredictions: 0,
    settledPredictions: 0,
    rankChanges: [],
    bestPrediction: null,
    isEmpty: true,
    error: null,
  }

  try {
    const [
      txResult,
      membershipsResult,
      poolsResult,
    ] = await Promise.all([
      supabase
        .from('points_transactions')
        .select('id, reason, points, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(RECENT_TRANSACTION_FETCH_LIMIT),
      supabase
        .from('pool_members')
        .select('id, pools(scoring_style)')
        .eq('user_id', userId),
      fetchDashboardPools(supabase, userId),
    ])

    if (txResult.error) {
      return { ...empty, error: txResult.error.message }
    }
    if (membershipsResult.error) {
      return { ...empty, error: membershipsResult.error.message }
    }

    const txRows = (txResult.data ?? []) as PointsTransactionRow[]
    const scoringEvents = txRows
      .filter((row) => isScoringReason(row.reason))
      .slice(0, RECENT_SCORING_EVENT_LIMIT)
    const recentEvents: RecentPointsEvent[] = scoringEvents.map((row) => ({
      id: row.id,
      reason: row.reason,
      description: getPointsTransactionDescription(row.reason),
      points: row.points,
      createdAt: row.created_at,
      relativeTime: formatRelativeTimestamp(row.created_at),
    }))
    const recentPointsTotal = recentEvents.reduce(
      (sum, row) => sum + row.points,
      0,
    )

    const memberships = (membershipsResult.data ?? []) as MembershipRow[]
    const memberContexts = memberships.flatMap((row) => {
      const pool = unwrapPool(row)
      if (!pool) return []
      return [{ memberId: row.id, scoringStyle: pool.scoring_style }]
    })
    const memberIds = memberContexts.map((row) => row.memberId)

    let winRate: number | null = null
    let correctPredictions = 0
    let settledPredictions = 0
    let bestPrediction: BestPrediction | null = null

    if (memberIds.length > 0) {
      const [
        counts,
        cacheResult,
        bestMatchResult,
        bestGroupResult,
        bestThirdResult,
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
      ])

      if (cacheResult.error) {
        return { ...empty, error: cacheResult.error.message }
      }

      const correctByMember = new Map<string, number>()
      for (const row of cacheResult.data ?? []) {
        correctByMember.set(row.member_id, row.correct_winners ?? 0)
      }

      correctPredictions = sumMemberCounts(memberIds, correctByMember)
      settledPredictions = sumMemberCounts(
        memberIds,
        counts.classicMatchPredictionsByMember,
      )
      winRate =
        settledPredictions > 0
          ? Math.round((correctPredictions / settledPredictions) * 100)
          : null

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
    }

    const rankChanges: RecentRankChange[] = (poolsResult.pools ?? [])
      .filter((pool) => pool.movement !== 'none' && pool.rankDelta > 0)
      .map((pool) => ({
        poolId: pool.id,
        poolName: pool.name,
        inviteCode: pool.inviteCode,
        yourRank: pool.yourRank,
        movement: pool.movement,
        rankDelta: pool.rankDelta,
      }))

    const isEmpty =
      recentEvents.length === 0 &&
      bestPrediction == null &&
      winRate == null &&
      rankChanges.length === 0

    return {
      recentPointsTotal,
      recentEvents,
      winRate,
      correctPredictions,
      settledPredictions,
      rankChanges,
      bestPrediction,
      isEmpty,
      error: poolsResult.error,
    }
  } catch (err) {
    return {
      ...empty,
      error:
        err instanceof Error ? err.message : 'Failed to load recent results',
    }
  }
}
