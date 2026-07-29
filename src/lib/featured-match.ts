import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveCurrentEventId } from '@/src/lib/current-event'

export const FEATURED_COMPETITION_LABEL = 'FIFA World Cup 2026'

export const FEATURED_LIVE_STATUS_SHORTS = [
  '1H',
  'HT',
  '2H',
  'ET',
  'BT',
  'P',
  'LIVE',
] as const

const LIVE_MAX_AGE_MINUTES = 210

const FEATURED_MATCH_COLUMNS =
  'id, team1_name, team2_name, team1_flag, team2_flag, result_team1, result_team2, status_short, elapsed_minute, kickoff_at, group_name, round, is_final'

export type FeaturedMatch = {
  id: string
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  result_team1: number | null
  result_team2: number | null
  status_short: string | null
  elapsed_minute: number | null
  kickoff_at: string
  group_name: string | null
  round: string
  is_final: boolean
}

export type FeaturedMatchMode = 'live' | 'upcoming' | 'final'

const ROUND_LABELS: Record<string, string> = {
  group: 'Group stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  third: '3rd Place Playoff',
  final: 'Final',
}

export function formatFeaturedMatchRoundLabel(
  round: string,
  groupName: string | null,
): string {
  if (round === 'group' && groupName) {
    return `Group Stage · Group ${groupName}`
  }
  return ROUND_LABELS[round] ?? round
}

export function formatFeaturedMatchStatusLabel(
  statusShort: string | null,
  elapsedMinute: number | null,
  isFinal: boolean,
): string {
  const status = (statusShort ?? '').trim().toUpperCase()

  if (isFinal || status === 'FT' || status === 'AET' || status === 'PEN') {
    return 'Full time'
  }
  if (status === 'HT') return 'Halftime'
  if (status === '1H' || status === '2H') {
    return elapsedMinute != null ? `${elapsedMinute}'` : status
  }
  if (status === 'NS') return 'Upcoming'
  if (elapsedMinute != null) return `${elapsedMinute}'`
  if (status === 'LIVE') return 'Live'
  return status || ''
}

export function formatFeaturedKickoffLocal(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatFeaturedCountdown(kickoffAt: string, nowMs: number): string | null {
  const ms = new Date(kickoffAt).getTime() - nowMs
  if (ms <= 0) return null

  const totalMinutes = Math.ceil(ms / 60_000)
  if (totalMinutes >= 48 * 60) return null

  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `Starts in ${days}d ${hours}h`
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`
  return `Starts in ${minutes}m`
}

export async function fetchFeaturedMatch(
  supabase: SupabaseClient,
  options?: { eventId?: string | null },
): Promise<{ match: FeaturedMatch | null; mode: FeaturedMatchMode | null }> {
  const nowIso = new Date().toISOString()
  const liveKickoffCutoff = new Date(
    Date.now() - LIVE_MAX_AGE_MINUTES * 60_000,
  ).toISOString()
  const eventId = await resolveCurrentEventId(supabase, options?.eventId)

  let liveByStatusQuery = supabase
    .from('matches')
    .select(FEATURED_MATCH_COLUMNS)
    .in('status_short', [...FEATURED_LIVE_STATUS_SHORTS])
    .eq('is_final', false)
    .gt('kickoff_at', liveKickoffCutoff)
    .order('kickoff_at', { ascending: false })
    .limit(1)
  if (eventId) liveByStatusQuery = liveByStatusQuery.eq('event_id', eventId)

  const { data: liveByStatus, error: liveStatusError } = await liveByStatusQuery

  if (liveStatusError) {
    throw new Error(liveStatusError.message)
  }

  if (liveByStatus?.[0]) {
    return { match: liveByStatus[0] as FeaturedMatch, mode: 'live' }
  }

  let liveByKickoffQuery = supabase
    .from('matches')
    .select(FEATURED_MATCH_COLUMNS)
    .lte('kickoff_at', nowIso)
    .eq('is_final', false)
    .gt('kickoff_at', liveKickoffCutoff)
    .order('kickoff_at', { ascending: false })
    .limit(1)
  if (eventId) liveByKickoffQuery = liveByKickoffQuery.eq('event_id', eventId)

  const { data: liveByKickoff, error: liveKickoffError } =
    await liveByKickoffQuery

  if (liveKickoffError) {
    throw new Error(liveKickoffError.message)
  }

  if (liveByKickoff?.[0]) {
    return { match: liveByKickoff[0] as FeaturedMatch, mode: 'live' }
  }

  let upcomingQuery = supabase
    .from('matches')
    .select(FEATURED_MATCH_COLUMNS)
    .gt('kickoff_at', nowIso)
    .eq('is_final', false)
    .order('kickoff_at', { ascending: true })
    .limit(1)
  if (eventId) upcomingQuery = upcomingQuery.eq('event_id', eventId)

  const { data: upcoming, error: upcomingError } = await upcomingQuery

  if (upcomingError) {
    throw new Error(upcomingError.message)
  }

  if (upcoming?.[0]) {
    return { match: upcoming[0] as FeaturedMatch, mode: 'upcoming' }
  }

  let recentFinalQuery = supabase
    .from('matches')
    .select(FEATURED_MATCH_COLUMNS)
    .eq('is_final', true)
    .order('kickoff_at', { ascending: false })
    .limit(1)
  if (eventId) recentFinalQuery = recentFinalQuery.eq('event_id', eventId)

  const { data: recentFinal, error: finalError } = await recentFinalQuery

  if (finalError) {
    throw new Error(finalError.message)
  }

  if (recentFinal?.[0]) {
    return { match: recentFinal[0] as FeaturedMatch, mode: 'final' }
  }

  return { match: null, mode: null }
}

/**
 * All matches currently live by status (featured live set).
 * Status-filtered only — no kickoff fallback — so stalled NS rows are excluded.
 */
export async function fetchLiveMatches(
  supabase: SupabaseClient,
  options?: { eventId?: string | null },
): Promise<FeaturedMatch[]> {
  const liveKickoffCutoff = new Date(
    Date.now() - LIVE_MAX_AGE_MINUTES * 60_000,
  ).toISOString()
  const eventId = await resolveCurrentEventId(supabase, options?.eventId)

  let query = supabase
    .from('matches')
    .select(FEATURED_MATCH_COLUMNS)
    .in('status_short', [...FEATURED_LIVE_STATUS_SHORTS])
    .eq('is_final', false)
    .gt('kickoff_at', liveKickoffCutoff)
    .order('kickoff_at', { ascending: false })
  if (eventId) query = query.eq('event_id', eventId)

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as FeaturedMatch[]
}
