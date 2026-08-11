import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizeSportKey,
  sportDisplayLabel,
} from '@/src/lib/sport-display'

export type ProfileSportStat = {
  sportKey: string
  sportLabel: string
  predictions: number
  exactScores: number
  correctWinners: number
  points: number
  accuracy: number | null
}

export type ProfileCompetitionStat = {
  eventId: string
  eventName: string
  sportKey: string
  sportLabel: string
  predictions: number
  exactScores: number
  correctWinners: number
  points: number
  accuracy: number | null
}

export type ProfileActivityItem =
  | {
      kind: 'scored_prediction'
      id: string
      occurredAt: string
      team1Name: string
      team2Name: string
      predTeam1: number
      predTeam2: number
      resultTeam1: number | null
      resultTeam2: number | null
      points: number
      eventName: string | null
      sportLabel: string | null
    }
  | {
      kind: 'badge'
      id: string
      occurredAt: string
      title: string
      achievementId: string
    }

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function accuracyOf(value: unknown): number | null {
  const n = asNumber(value)
  if (n == null || Number.isNaN(n)) return null
  return Math.round(n)
}

/**
 * Per-sport stats via `get_public_profile_sport_stats` (final matches only).
 */
export async function fetchProfileSportStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ sports: ProfileSportStat[]; error: string | null }> {
  if (!userId) return { sports: [], error: null }

  const { data, error } = await supabase.rpc(
    'get_public_profile_sport_stats',
    { p_user_id: userId },
  )

  if (error) {
    console.error('get_public_profile_sport_stats failed:', error.message)
    return { sports: [], error: error.message }
  }

  const sports: ProfileSportStat[] = []
  for (const raw of data ?? []) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const sport = asString(row.sport) ?? 'football'
    sports.push({
      sportKey: normalizeSportKey(sport),
      sportLabel: sportDisplayLabel(sport),
      predictions: Math.max(0, asNumber(row.predictions) ?? 0),
      exactScores: Math.max(0, asNumber(row.exact) ?? 0),
      correctWinners: Math.max(0, asNumber(row.correct) ?? 0),
      points: Math.max(0, asNumber(row.points) ?? 0),
      accuracy: accuracyOf(row.accuracy),
    })
  }

  sports.sort((a, b) => b.predictions - a.predictions)
  return { sports, error: null }
}

/**
 * Per-competition stats via `get_public_profile_competition_stats`.
 */
export async function fetchProfileCompetitionStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ competitions: ProfileCompetitionStat[]; error: string | null }> {
  if (!userId) return { competitions: [], error: null }

  const { data, error } = await supabase.rpc(
    'get_public_profile_competition_stats',
    { p_user_id: userId },
  )

  if (error) {
    console.error(
      'get_public_profile_competition_stats failed:',
      error.message,
    )
    return { competitions: [], error: error.message }
  }

  const competitions: ProfileCompetitionStat[] = []
  for (const raw of data ?? []) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const eventId = asString(row.event_id)
    if (!eventId) continue
    const sport = asString(row.sport) ?? 'football'
    competitions.push({
      eventId,
      eventName: asString(row.event_name)?.trim() || 'Competition',
      sportKey: normalizeSportKey(sport),
      sportLabel: sportDisplayLabel(sport),
      predictions: Math.max(0, asNumber(row.predictions) ?? 0),
      exactScores: Math.max(0, asNumber(row.exact) ?? 0),
      correctWinners: Math.max(0, asNumber(row.correct) ?? 0),
      points: Math.max(0, asNumber(row.points) ?? 0),
      accuracy: accuracyOf(row.accuracy),
    })
  }

  competitions.sort((a, b) => b.predictions - a.predictions)
  return { competitions, error: null }
}

/** Combined sport + competition breakdown (RPC-backed). */
export async function fetchProfileBreakdownStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  sports: ProfileSportStat[]
  competitions: ProfileCompetitionStat[]
  error: string | null
}> {
  const [sportsResult, compsResult] = await Promise.all([
    fetchProfileSportStats(supabase, userId),
    fetchProfileCompetitionStats(supabase, userId),
  ])

  return {
    sports: sportsResult.sports,
    competitions: compsResult.competitions,
    error: sportsResult.error || compsResult.error,
  }
}

/**
 * Recent POST-LOCK scored predictions via `get_public_profile_activity`.
 * Never returns unlocked/upcoming picks of others.
 * Optionally merges public badge unlocks (read-only, not admin).
 */
export async function fetchProfileRecentActivity(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    limit?: number
    /** @deprecated Ignored — activity RPC is post-lock only for all viewers. */
    includeUpcomingOwnPicks?: boolean
  },
): Promise<{ items: ProfileActivityItem[]; error: string | null }> {
  const limit = options?.limit ?? 12
  if (!userId) return { items: [], error: null }

  const { data, error } = await supabase.rpc('get_public_profile_activity', {
    p_user_id: userId,
    p_limit: Math.max(limit, 12),
  })

  if (error) {
    console.error('get_public_profile_activity failed:', error.message)
    return { items: [], error: error.message }
  }

  const items: ProfileActivityItem[] = []

  for (const raw of data ?? []) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const matchId = asString(row.match_id)
    if (!matchId) continue

    items.push({
      kind: 'scored_prediction',
      id: `pred-${matchId}`,
      occurredAt: asString(row.kickoff_at) || new Date(0).toISOString(),
      team1Name: asString(row.team1_name)?.trim() || 'Team 1',
      team2Name: asString(row.team2_name)?.trim() || 'Team 2',
      predTeam1: Math.max(0, asNumber(row.pred_team1) ?? 0),
      predTeam2: Math.max(0, asNumber(row.pred_team2) ?? 0),
      resultTeam1: asNumber(row.result_team1),
      resultTeam2: asNumber(row.result_team2),
      points: Math.max(0, asNumber(row.points_awarded) ?? 0),
      eventName: asString(row.event_name),
      sportLabel: asString(row.sport)
        ? sportDisplayLabel(asString(row.sport)!)
        : null,
    })
  }

  // Badge unlocks are public catalogue joins (not prediction privacy).
  const { data: badges, error: badgeErr } = await supabase
    .from('user_achievements')
    .select('achievement_id, earned_at, achievements(name)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })
    .limit(8)

  if (badgeErr) {
    console.error('fetchProfileRecentActivity badges:', badgeErr.message)
  } else {
    for (const row of badges ?? []) {
      const ach = row.achievements as
        | { name: string }
        | { name: string }[]
        | null
      const name = Array.isArray(ach) ? ach[0]?.name : ach?.name
      items.push({
        kind: 'badge',
        id: `badge-${row.achievement_id}-${row.earned_at}`,
        occurredAt: (row.earned_at as string) || '',
        title: name?.trim() || 'Badge unlocked',
        achievementId: row.achievement_id as string,
      })
    }
  }

  items.sort((a, b) =>
    (b.occurredAt || '').localeCompare(a.occurredAt || ''),
  )

  return { items: items.slice(0, limit), error: null }
}
