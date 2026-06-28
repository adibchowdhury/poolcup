import type {
  LeaderboardMember,
  LeaderboardPointBreakdownItem,
} from '@/components/pool/leaderboard-row'
import { buildLeaderboardPlaceGroups } from '@/components/pool/leaderboard-grouped-list'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getPredictionOutcome,
  getPredictionOutcomeLabel,
  type MatchScoringStyle,
} from '@/src/lib/prediction-scoring'
import {
  deserializeWinnerLeaderboardBreakdown,
  type SerializedWinnerLeaderboardBreakdown,
} from '@/src/lib/winner-leaderboard-breakdown'
import { expandClassicKnockoutBreakdownLines } from '@/src/lib/classic-knockout-breakdown-lines'
import { isKnockoutRound } from '@/src/lib/classic-round-tab-logic'

export type PoolLeaderboardMember = {
  id: string
  user_id: string
  display_name: string
  joined_at: string
}

export type LeaderboardCacheRow = {
  rank: number
  prev_rank: number | null
  member_id: string
  total_points: number | null
  correct_winners?: number | null
}

type BuildPoolLeaderboardParams = {
  poolMembers: PoolLeaderboardMember[]
  creatorUserId: string
  cacheRows: LeaderboardCacheRow[] | null
  matchesPlayedCount: number
  currentUserId: string
  predictionsByMember: Map<string, number>
  isWinnerPool: boolean
  avatarsByMemberId: Map<string, string | null>
  breakdownByMember?: Map<string, LeaderboardPointBreakdownItem[]>
}

type PredictionBreakdownQueryRow = {
  member_id: string
  match_id: string
  pred_team1: number
  pred_team2: number
  advance_pick: number | null
  points_awarded: number
  matches:
    | {
        team1_name: string
        team2_name: string
        result_team1: number
        result_team2: number
        advancing_team: number | null
        round: string
        group_name: string | null
        kickoff_at: string
        is_final: boolean
        locked_at: string
      }
    | {
        team1_name: string
        team2_name: string
        result_team1: number
        result_team2: number
        advancing_team: number | null
        round: string
        group_name: string | null
        kickoff_at: string
        is_final: boolean
        locked_at: string
      }[]
    | null
}

function sortPoolMembersForPreMatch(
  members: PoolLeaderboardMember[],
  creatorUserId: string,
): PoolLeaderboardMember[] {
  const creator = members.find((m) => m.user_id === creatorUserId)
  const rest = members
    .filter((m) => m.user_id !== creatorUserId)
    .sort(
      (a, b) =>
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
    )

  return creator ? [creator, ...rest] : rest
}

function getMovement(
  rank: number,
  prevRank: number | null,
): 'up' | 'down' | 'none' {
  if (prevRank == null || prevRank <= 0) return 'none'
  const delta = prevRank - rank
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'none'
}

function hasLeaderboardCacheData(
  cacheRows: LeaderboardCacheRow[] | null,
): boolean {
  return (cacheRows?.length ?? 0) > 0
}

export async function fetchPoolLeaderboardPointBreakdown(
  supabase: SupabaseClient,
  poolId: string,
  scoringStyle: MatchScoringStyle = 'classic',
): Promise<{
  breakdownByMember: Map<string, LeaderboardPointBreakdownItem[]>
  error: string | null
}> {
  const breakdownByMember = new Map<string, LeaderboardPointBreakdownItem[]>()

  const { data, error } = await supabase
    .from('predictions')
    .select(
      `
      member_id,
      match_id,
      pred_team1,
      pred_team2,
      advance_pick,
      points_awarded,
      matches!inner (
        team1_name,
        team2_name,
        result_team1,
        result_team2,
        advancing_team,
        round,
        group_name,
        kickoff_at,
        is_final,
        locked_at
      )
    `,
    )
    .eq('pool_id', poolId)
    .eq('matches.is_final', true)

  if (error) {
    return { breakdownByMember, error: error.message }
  }

  for (const row of (data ?? []) as PredictionBreakdownQueryRow[]) {
    const matchRaw = row.matches
    const match = Array.isArray(matchRaw) ? matchRaw[0] : matchRaw
    if (!match) continue
    if (match.result_team1 == null || match.result_team2 == null) continue

    const isKnockout = isKnockoutRound(match.round)
    if (row.points_awarded <= 0) {
      continue
    }

    const list = breakdownByMember.get(row.member_id) ?? []

    if (isKnockout) {
      list.push(
        ...expandClassicKnockoutBreakdownLines({
          matchId: row.match_id,
          predTeam1: row.pred_team1,
          predTeam2: row.pred_team2,
          advancePick: row.advance_pick,
          pointsAwarded: row.points_awarded,
          team1Name: match.team1_name,
          team2Name: match.team2_name,
          resultTeam1: match.result_team1,
          resultTeam2: match.result_team2,
          round: match.round,
          groupName: match.group_name,
          kickoffAt: match.kickoff_at,
          advancingTeam: match.advancing_team,
        }),
      )
      breakdownByMember.set(row.member_id, list)
      continue
    }

    const outcome = getPredictionOutcome(
      row.pred_team1,
      row.pred_team2,
      match.result_team1,
      match.result_team2,
      scoringStyle,
    )

    const item: LeaderboardPointBreakdownItem = {
      matchId: row.match_id,
      predTeam1: row.pred_team1,
      predTeam2: row.pred_team2,
      pointsAwarded: row.points_awarded,
      reasonLabel: getPredictionOutcomeLabel(outcome.kind),
      team1Name: match.team1_name,
      team2Name: match.team2_name,
      resultTeam1: match.result_team1,
      resultTeam2: match.result_team2,
      round: match.round,
      groupName: match.group_name,
      kickoffAt: match.kickoff_at,
    }

    list.push(item)
    breakdownByMember.set(row.member_id, list)
  }

  for (const [memberId, items] of breakdownByMember) {
    const positiveItems = items.filter((item) => item.pointsAwarded > 0)
    positiveItems.sort(
      (a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    )
    breakdownByMember.set(memberId, positiveItems)
  }

  return { breakdownByMember, error: null }
}

export async function fetchWinnerPoolLeaderboardPointBreakdown(
  poolId: string,
): Promise<{
  breakdownByMember: Map<string, LeaderboardPointBreakdownItem[]>
  error: string | null
}> {
  const breakdownByMember = new Map<string, LeaderboardPointBreakdownItem[]>()

  try {
    const response = await fetch(
      `/api/pools/${encodeURIComponent(poolId)}/winner-leaderboard-breakdown`,
      { credentials: 'include' },
    )

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      return {
        breakdownByMember,
        error: body?.error ?? `Failed to load breakdown (${response.status})`,
      }
    }

    const body = (await response.json()) as {
      breakdownByMember: SerializedWinnerLeaderboardBreakdown
    }

    return {
      breakdownByMember: deserializeWinnerLeaderboardBreakdown(
        body.breakdownByMember ?? {},
      ),
      error: null,
    }
  } catch (error) {
    return {
      breakdownByMember,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load winner leaderboard breakdown',
    }
  }
}

export function verifyLeaderboardBreakdownTotals(members: LeaderboardMember[]): {
  ok: boolean
  mismatches: Array<{
    memberId: string
    name: string
    headerPoints: number
    breakdownSum: number
  }>
} {
  const mismatches: Array<{
    memberId: string
    name: string
    headerPoints: number
    breakdownSum: number
  }> = []

  for (const member of members) {
    if (member.pointBreakdown === undefined) continue

    const breakdownSum = member.pointBreakdown.reduce(
      (sum, item) => sum + item.pointsAwarded,
      0,
    )

    if (breakdownSum !== member.points) {
      mismatches.push({
        memberId: member.id,
        name: member.name,
        headerPoints: member.points,
        breakdownSum,
      })
    }
  }

  return { ok: mismatches.length === 0, mismatches }
}

export function verifyLeaderboardBreakdownPointDerivation(
  members: LeaderboardMember[],
  scoringStyle: MatchScoringStyle = 'classic',
): {
  ok: boolean
  divergences: Array<{
    memberId: string
    memberName: string
    matchId: string
    helperPoints: number
    pointsAwarded: number
    reasonLabel: string
  }>
} {
  const divergences: Array<{
    memberId: string
    memberName: string
    matchId: string
    helperPoints: number
    pointsAwarded: number
    reasonLabel: string
  }> = []

  for (const member of members) {
    if (!member.pointBreakdown) continue

    for (const item of member.pointBreakdown) {
      if (item.lineId || isKnockoutRound(item.round)) continue

      const outcome = getPredictionOutcome(
        item.predTeam1,
        item.predTeam2,
        item.resultTeam1,
        item.resultTeam2,
        scoringStyle,
      )

      if (outcome.points !== item.pointsAwarded) {
        divergences.push({
          memberId: member.id,
          memberName: member.name,
          matchId: item.matchId,
          helperPoints: outcome.points,
          pointsAwarded: item.pointsAwarded,
          reasonLabel: item.reasonLabel,
        })
      }
    }
  }

  return { ok: divergences.length === 0, divergences }
}

export function buildPoolLeaderboardMembers({
  poolMembers,
  creatorUserId,
  cacheRows,
  matchesPlayedCount,
  currentUserId,
  predictionsByMember,
  isWinnerPool,
  avatarsByMemberId,
  breakdownByMember,
}: BuildPoolLeaderboardParams): LeaderboardMember[] {
  const cacheByMember = new Map(
    (cacheRows ?? []).map((row) => [row.member_id, row]),
  )
  const useCache =
    hasLeaderboardCacheData(cacheRows) &&
    (isWinnerPool || matchesPlayedCount > 0)

  let entries: Array<{
    member_id: string
    user_id: string
    display_name: string
    points: number
    correct_predictions: number
    rank: number
    prev_rank: number | null
  }>

  if (!useCache && matchesPlayedCount === 0) {
    const ordered = sortPoolMembersForPreMatch(poolMembers, creatorUserId)
    entries = ordered.map((member, index) => ({
      rank: index + 1,
      prev_rank: null,
      member_id: member.id,
      user_id: member.user_id,
      display_name: member.display_name,
      points: 0,
      correct_predictions: 0,
    }))
  } else if (useCache) {
    entries = poolMembers.map((member) => {
      const row = cacheByMember.get(member.id)
      return {
        rank: row?.rank ?? poolMembers.length,
        prev_rank:
          row?.prev_rank != null && row.prev_rank > 0 ? row.prev_rank : null,
        member_id: member.id,
        user_id: member.user_id,
        display_name: member.display_name,
        points: row?.total_points ?? 0,
        correct_predictions: isWinnerPool ? 0 : (row?.correct_winners ?? 0),
      }
    })
  } else {
    entries = poolMembers.map((member, index) => ({
      rank: index + 1,
      prev_rank: null,
      member_id: member.id,
      user_id: member.user_id,
      display_name: member.display_name,
      points: 0,
      correct_predictions: 0,
    }))
  }

  return entries.map((entry) => ({
    id: entry.member_id,
    userId: entry.user_id,
    name: entry.display_name,
    isYou: currentUserId === entry.user_id,
    avatar: avatarsByMemberId.get(entry.member_id) ?? null,
    points: entry.points,
    correctPredictions: entry.correct_predictions,
    totalPredictions: predictionsByMember.get(entry.member_id) ?? 0,
    movement: getMovement(entry.rank, entry.prev_rank),
    streak: 0,
    pointBreakdown: breakdownByMember?.get(entry.member_id) ?? [],
  }))
}

export function getMemberConsecutivePlace(
  members: LeaderboardMember[],
  memberId: string,
): number | null {
  const groups = buildLeaderboardPlaceGroups(members)
  for (const group of groups) {
    if (group.members.some((member) => member.id === memberId)) {
      return group.place
    }
  }
  return null
}

export function poolHasLeaderboardResults(
  members: LeaderboardMember[],
  matchesPlayedCount: number,
  isWinnerPool: boolean,
): boolean {
  if (matchesPlayedCount > 0) return true
  if (isWinnerPool && members.some((member) => member.points > 0)) return true
  return false
}
