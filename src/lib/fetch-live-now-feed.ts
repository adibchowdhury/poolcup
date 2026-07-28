import type { SupabaseClient } from '@supabase/supabase-js'
import type { RankMovement } from '@/components/dashboard/pool-card'
import {
  fetchLiveMatches,
  type FeaturedMatch,
} from '@/src/lib/featured-match'
import { fetchDashboardPools } from '@/src/lib/fetch-dashboard-pools'
import { projectMatchPoints } from '@/src/lib/project-match-points'
import type { PredictionOutcomeKind } from '@/src/lib/prediction-scoring'

export type LiveNowPickProjection = {
  poolId: string
  poolName: string
  inviteCode: string
  predTeam1: number
  predTeam2: number
  kind: PredictionOutcomeKind | 'pending'
  projectedPoints: number
  statusLabel: string
}

export type LiveNowMatchItem = {
  match: FeaturedMatch
  picks: LiveNowPickProjection[]
}

export type LiveNowStandingItem = {
  poolId: string
  poolName: string
  inviteCode: string
  yourRank: number | null
  movement: RankMovement
  rankDelta: number
}

export type LiveNowFeedData = {
  matches: LiveNowMatchItem[]
  /** Snapshot standings (rank + last scored movement) — not mid-match streaming. */
  standings: LiveNowStandingItem[]
  error: string | null
}

type MembershipRow = {
  id: string
  pool_id: string
  pools:
    | {
        id: string
        name: string
        invite_code: string
        scoring_style: string
      }
    | {
        id: string
        name: string
        invite_code: string
        scoring_style: string
      }[]
    | null
}

type PredictionRow = {
  pool_id: string
  member_id: string
  match_id: string
  pred_team1: number
  pred_team2: number
  advance_pick: number | null
}

function unwrapPool(row: MembershipRow) {
  const raw = row.pools
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function liveStatusLabel(kind: PredictionOutcomeKind): string {
  switch (kind) {
    case 'exact':
      return 'On track · Exact'
    case 'draw':
      return 'On track · Draw'
    case 'winner':
      return 'On track · Winner'
    case 'wrong':
      return 'Off track'
  }
}

function projectPick(
  match: FeaturedMatch,
  pred: PredictionRow,
  pool: { name: string; invite_code: string },
): LiveNowPickProjection {
  const score1 = match.result_team1
  const score2 = match.result_team2

  if (score1 == null || score2 == null) {
    return {
      poolId: pred.pool_id,
      poolName: pool.name,
      inviteCode: pool.invite_code,
      predTeam1: pred.pred_team1,
      predTeam2: pred.pred_team2,
      kind: 'pending',
      projectedPoints: 0,
      statusLabel: 'Awaiting score',
    }
  }

  const projection = projectMatchPoints(
    match.round,
    pred.pred_team1,
    pred.pred_team2,
    pred.advance_pick,
    score1,
    score2,
    null,
  )

  return {
    poolId: pred.pool_id,
    poolName: pool.name,
    inviteCode: pool.invite_code,
    predTeam1: pred.pred_team1,
    predTeam2: pred.pred_team2,
    kind: projection.kind,
    projectedPoints: projection.points,
    statusLabel: liveStatusLabel(projection.kind),
  }
}

export async function fetchLiveNowFeed(
  supabase: SupabaseClient,
  userId: string,
): Promise<LiveNowFeedData> {
  try {
    const liveMatches = await fetchLiveMatches(supabase)

    if (liveMatches.length === 0) {
      return { matches: [], standings: [], error: null }
    }

    const matchIds = liveMatches.map((match) => match.id)

    const [membershipsResult, poolsResult] = await Promise.all([
      supabase
        .from('pool_members')
        .select(
          'id, pool_id, pools(id, name, invite_code, scoring_style)',
        )
        .eq('user_id', userId),
      fetchDashboardPools(supabase, userId),
    ])

    if (membershipsResult.error) {
      return {
        matches: [],
        standings: [],
        error: membershipsResult.error.message,
      }
    }

    const memberships = (membershipsResult.data ?? []) as MembershipRow[]
    const poolById = new Map<
      string,
      { name: string; invite_code: string; scoring_style: string }
    >()
    const memberIds: string[] = []

    for (const row of memberships) {
      const pool = unwrapPool(row)
      if (!pool) continue
      memberIds.push(row.id)
      poolById.set(pool.id, {
        name: pool.name,
        invite_code: pool.invite_code,
        scoring_style: pool.scoring_style,
      })
    }

    let predictionRows: PredictionRow[] = []
    if (memberIds.length > 0) {
      const { data: preds, error: predError } = await supabase
        .from('predictions')
        .select(
          'pool_id, member_id, match_id, pred_team1, pred_team2, advance_pick',
        )
        .in('member_id', memberIds)
        .in('match_id', matchIds)

      if (predError) {
        return { matches: [], standings: [], error: predError.message }
      }

      predictionRows = (preds ?? []) as PredictionRow[]
    }

    const predsByMatchId = new Map<string, PredictionRow[]>()
    for (const row of predictionRows) {
      const pool = poolById.get(row.pool_id)
      // Winner-only pools don't store match scorelines here.
      if (!pool || pool.scoring_style === 'winner') continue
      const list = predsByMatchId.get(row.match_id) ?? []
      list.push(row)
      predsByMatchId.set(row.match_id, list)
    }

    const matches: LiveNowMatchItem[] = liveMatches.map((match) => {
      const rows = predsByMatchId.get(match.id) ?? []
      const picks = rows.flatMap((row) => {
        const pool = poolById.get(row.pool_id)
        if (!pool) return []
        return [projectPick(match, row, pool)]
      })
      return { match, picks }
    })

    const standings: LiveNowStandingItem[] = (poolsResult.pools ?? []).map(
      (pool) => ({
        poolId: pool.id,
        poolName: pool.name,
        inviteCode: pool.inviteCode,
        yourRank: pool.yourRank,
        movement: pool.movement,
        rankDelta: pool.rankDelta,
      }),
    )

    return {
      matches,
      standings,
      error: poolsResult.error,
    }
  } catch (err) {
    return {
      matches: [],
      standings: [],
      error: err instanceof Error ? err.message : 'Failed to load live matches',
    }
  }
}
