import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchBannedUserIdsAmong } from '@/src/lib/banned-users'
import { buildCsv } from '@/src/lib/csv'
import {
  resolveClassicScorePoints,
} from '@/src/lib/classic-score-points'

export type PoolExportMeta = {
  poolId: string
  inviteCode: string
  name: string
  eventName: string | null
  scoringStyle: string
  scoreExactPoints: number | null
  scoreWinnerPoints: number | null
  scoreDrawPoints: number | null
  memberCount: number
  /** ISO-8601 timestamp (safe to pass Server → Client). */
  generatedAt: string
}

export type LeaderboardExportRow = {
  rank: number
  displayName: string
  username: string | null
  totalPoints: number
  predictionsMade: number
  correctPredictions: number
}

export type PredictionExportRow = {
  displayName: string
  username: string | null
  matchLabel: string
  kickoffAt: string | null
  predicted: string
  actualResult: string | null
  pointsAwarded: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function str(
  row: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function num(
  row: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

export function formatScoringRules(meta: {
  scoringStyle: string
  scoreExactPoints: number | null
  scoreWinnerPoints: number | null
  scoreDrawPoints: number | null
}): string {
  if (meta.scoringStyle === 'winner') {
    return 'Winner only'
  }
  const points = resolveClassicScorePoints({
    scoreExactPoints: meta.scoreExactPoints,
    scoreWinnerPoints: meta.scoreWinnerPoints,
    scoreDrawPoints: meta.scoreDrawPoints,
  })
  return `Classic — Exact ${points.exact}, Winner ${points.winner}, Draw ${points.draw}`
}

export function formatGeneratedAt(value: string | Date): {
  iso: string
  human: string
} {
  const date = value instanceof Date ? value : new Date(value)
  const iso = Number.isNaN(date.getTime())
    ? String(value)
    : date.toISOString()
  const human = Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(date)
  return { iso, human: `${human} UTC` }
}

export function buildExportMetadataRows(meta: PoolExportMeta): unknown[][] {
  const { iso, human } = formatGeneratedAt(meta.generatedAt)
  return [
    ['Pool name', meta.name],
    ['Competition', meta.eventName || '—'],
    ['Scoring', formatScoringRules(meta)],
    ['Members', meta.memberCount],
    ['Generated at', `${iso} (${human})`],
    [],
  ]
}

export async function loadPoolExportMeta(
  admin: SupabaseClient,
  poolId: string,
): Promise<PoolExportMeta | null> {
  const { data: pool, error } = await admin
    .from('pools')
    .select(
      'id, name, invite_code, event_id, event_name, scoring_style, score_exact_points, score_winner_points, score_draw_points',
    )
    .eq('id', poolId)
    .maybeSingle()

  if (error || !pool) return null

  const { count } = await admin
    .from('pool_members')
    .select('id', { count: 'exact', head: true })
    .eq('pool_id', poolId)

  let eventName =
    typeof pool.event_name === 'string' && pool.event_name.trim()
      ? pool.event_name.trim()
      : null

  if (!eventName && pool.event_id) {
    const { data: event } = await admin
      .from('sporting_events')
      .select('name')
      .eq('id', pool.event_id)
      .maybeSingle()
    eventName = event?.name?.trim() || null
  }

  return {
    poolId: pool.id as string,
    inviteCode: String(pool.invite_code ?? ''),
    name: String(pool.name ?? 'Pool'),
    eventName,
    scoringStyle:
      typeof pool.scoring_style === 'string' ? pool.scoring_style : 'classic',
    scoreExactPoints:
      typeof pool.score_exact_points === 'number'
        ? pool.score_exact_points
        : null,
    scoreWinnerPoints:
      typeof pool.score_winner_points === 'number'
        ? pool.score_winner_points
        : null,
    scoreDrawPoints:
      typeof pool.score_draw_points === 'number'
        ? pool.score_draw_points
        : null,
    memberCount: Math.max(0, count ?? 0),
    generatedAt: new Date().toISOString(),
  }
}

export function parseLeaderboardExportRows(
  data: unknown,
): LeaderboardExportRow[] {
  if (!Array.isArray(data)) return []
  return data
    .map((raw) => {
      const row = asRecord(raw)
      if (!row) return null
      const displayName =
        str(row, 'display_name', 'displayName') || 'Member'
      return {
        rank: Math.max(0, num(row, 'rank') ?? 0),
        displayName,
        username: str(row, 'username'),
        totalPoints: num(row, 'total_points', 'totalPoints') ?? 0,
        predictionsMade:
          num(row, 'predictions_made', 'predictionsMade') ?? 0,
        correctPredictions:
          num(row, 'correct_predictions', 'correctPredictions') ?? 0,
      } satisfies LeaderboardExportRow
    })
    .filter((r): r is LeaderboardExportRow => r != null)
}

export function parsePredictionExportRows(
  data: unknown,
): PredictionExportRow[] {
  if (!Array.isArray(data)) return []
  return data
    .map((raw) => {
      const row = asRecord(raw)
      if (!row) return null
      return {
        displayName: str(row, 'display_name', 'displayName') || 'Member',
        username: str(row, 'username'),
        matchLabel: str(row, 'match_label', 'matchLabel') || 'Match',
        kickoffAt: str(row, 'kickoff_at', 'kickoffAt'),
        predicted: str(row, 'predicted') || '',
        actualResult: str(row, 'actual_result', 'actualResult'),
        pointsAwarded: num(row, 'points_awarded', 'pointsAwarded'),
      } satisfies PredictionExportRow
    })
    .filter((r): r is PredictionExportRow => r != null)
}

export async function fetchLeaderboardExportRows(
  admin: SupabaseClient,
  actorId: string,
  poolId: string,
): Promise<{ rows: LeaderboardExportRow[]; error: string | null }> {
  const { data, error } = await admin.rpc('export_pool_leaderboard', {
    p_actor_id: actorId,
    p_pool_id: poolId,
  })
  if (error) {
    return { rows: [], error: error.message }
  }

  const rows = parseLeaderboardExportRows(data)
  if (rows.length === 0) {
    return { rows, error: null }
  }

  const { data: members } = await admin
    .from('pool_members')
    .select('user_id')
    .eq('pool_id', poolId)

  const memberUserIds = (members ?? [])
    .map((row) => row.user_id)
    .filter((id): id is string => typeof id === 'string')

  const bannedIds = await fetchBannedUserIdsAmong(admin, memberUserIds)
  if (bannedIds.size === 0) {
    return { rows, error: null }
  }

  const { data: bannedProfiles } = await admin
    .from('users')
    .select('username, display_name')
    .in('id', [...bannedIds])

  const bannedUsernames = new Set(
    (bannedProfiles ?? [])
      .map((row) => row.username?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  )
  const bannedDisplayNames = new Set(
    (bannedProfiles ?? [])
      .map((row) => row.display_name?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  )

  const filtered = rows.filter((row) => {
    const username = row.username?.trim().toLowerCase() ?? ''
    const displayName = row.displayName.trim().toLowerCase()
    if (username && bannedUsernames.has(username)) return false
    if (!username && displayName && bannedDisplayNames.has(displayName)) {
      return false
    }
    return true
  })

  const reranked = filtered
    .slice()
    .sort(
      (a, b) => a.rank - b.rank || a.displayName.localeCompare(b.displayName),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }))

  return { rows: reranked, error: null }
}

export async function fetchPredictionExportRows(
  admin: SupabaseClient,
  actorId: string,
  poolId: string,
): Promise<{ rows: PredictionExportRow[]; error: string | null }> {
  const { data, error } = await admin.rpc('export_pool_predictions', {
    p_actor_id: actorId,
    p_pool_id: poolId,
  })
  if (error) {
    return { rows: [], error: error.message }
  }
  return { rows: parsePredictionExportRows(data), error: null }
}

export function buildLeaderboardCsv(
  meta: PoolExportMeta,
  rows: LeaderboardExportRow[],
): string {
  const body: unknown[][] = [
    ...buildExportMetadataRows(meta),
    [
      'rank',
      'display_name',
      'username',
      'total_points',
      'predictions_made',
      'correct_predictions',
    ],
    ...rows.map((r) => [
      r.rank,
      r.displayName,
      r.username ?? '',
      r.totalPoints,
      r.predictionsMade,
      r.correctPredictions,
    ]),
  ]
  return buildCsv(body)
}

export function buildPredictionsCsv(
  meta: PoolExportMeta,
  rows: PredictionExportRow[],
): string {
  const body: unknown[][] = [
    ...buildExportMetadataRows(meta),
    [
      'display_name',
      'username',
      'match_label',
      'kickoff_at',
      'predicted',
      'actual_result',
      'points_awarded',
    ],
    ...rows.map((r) => [
      r.displayName,
      r.username ?? '',
      r.matchLabel,
      r.kickoffAt ?? '',
      r.predicted,
      r.actualResult ?? '',
      r.pointsAwarded ?? '',
    ]),
  ]
  return buildCsv(body)
}

export function csvAttachmentResponse(
  csv: string,
  filename: string,
  rowCount: number,
): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Export-Row-Count': String(rowCount),
      'X-Export-Empty': rowCount === 0 ? '1' : '0',
    },
  })
}
