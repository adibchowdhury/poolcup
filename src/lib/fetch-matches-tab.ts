import type { SupabaseClient } from '@supabase/supabase-js'
import { FEATURED_LIVE_STATUS_SHORTS } from '@/src/lib/featured-match'
import {
  isVoidMatchStatus,
  VOID_MATCH_STATUS_SHORTS,
} from '@/src/lib/match-void-status'
import {
  getUpcomingHorizonEndIso,
  isWithinUpcomingHorizon,
} from '@/src/lib/upcoming-match-horizon'

const MATCHES_TAB_COLUMNS =
  'id, event_id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, team1_logo, team2_logo, group_name, round, status_short, result_team1, result_team2, elapsed_minute, is_final'

/** Full schedule list for the Matches tab (higher than the dashboard slider cap). */
export const MATCHES_TAB_QUERY_LIMIT = 300

/** How far back to include completed fixtures on the Matches tab. */
const COMPLETED_LOOKBACK_DAYS = 14

export type MatchesTabMatch = {
  id: string
  event_id: string | null
  kickoff_at: string
  locked_at: string | null
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  team1_logo?: string | null
  team2_logo?: string | null
  group_name: string | null
  round: string
  status_short: string | null
  result_team1: number | null
  result_team2: number | null
  elapsed_minute: number | null
  is_final: boolean
}

export function isMatchesTabLive(statusShort: string | null): boolean {
  const status = (statusShort ?? '').trim().toUpperCase()
  return (FEATURED_LIVE_STATUS_SHORTS as readonly string[]).includes(status)
}

/**
 * Live + upcoming-within-horizon + recent completed matches for the Matches tab.
 * Pass `eventIds` to scope to selected events; omit / empty returns [].
 */
export async function fetchMatchesTabMatches(
  supabase: SupabaseClient,
  eventIds: string[],
  nowMs: number = Date.now(),
): Promise<MatchesTabMatch[]> {
  if (eventIds.length === 0) return []

  const nowIso = new Date(nowMs).toISOString()
  const horizonEndIso = getUpcomingHorizonEndIso(nowMs)
  const completedSinceIso = new Date(
    nowMs - COMPLETED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const [liveResult, upcomingResult, completedResult, voidResult] =
    await Promise.all([
    supabase
      .from('matches')
      .select(MATCHES_TAB_COLUMNS)
      .in('event_id', eventIds)
      .in('status_short', [...FEATURED_LIVE_STATUS_SHORTS])
      .eq('is_final', false)
      .order('kickoff_at', { ascending: false })
      .limit(MATCHES_TAB_QUERY_LIMIT),
    supabase
      .from('matches')
      .select(MATCHES_TAB_COLUMNS)
      .in('event_id', eventIds)
      .gt('kickoff_at', nowIso)
      .lte('kickoff_at', horizonEndIso)
      .eq('is_final', false)
      .order('kickoff_at', { ascending: true })
      .limit(MATCHES_TAB_QUERY_LIMIT),
    supabase
      .from('matches')
      .select(MATCHES_TAB_COLUMNS)
      .in('event_id', eventIds)
      .eq('is_final', true)
      .gte('kickoff_at', completedSinceIso)
      .lte('kickoff_at', nowIso)
      .order('kickoff_at', { ascending: false })
      .limit(MATCHES_TAB_QUERY_LIMIT),
    supabase
      .from('matches')
      .select(MATCHES_TAB_COLUMNS)
      .in('event_id', eventIds)
      .in('status_short', [...VOID_MATCH_STATUS_SHORTS])
      .gte('kickoff_at', completedSinceIso)
      .order('kickoff_at', { ascending: false })
      .limit(MATCHES_TAB_QUERY_LIMIT),
  ])

  if (liveResult.error) throw new Error(liveResult.error.message)
  if (upcomingResult.error) throw new Error(upcomingResult.error.message)
  if (completedResult.error) throw new Error(completedResult.error.message)
  if (voidResult.error) throw new Error(voidResult.error.message)

  const seen = new Set<string>()
  const merged: MatchesTabMatch[] = []
  for (const row of [
    ...((liveResult.data ?? []) as MatchesTabMatch[]),
    ...((upcomingResult.data ?? []) as MatchesTabMatch[]),
    ...((completedResult.data ?? []) as MatchesTabMatch[]),
    ...((voidResult.data ?? []) as MatchesTabMatch[]),
  ]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }

  const filtered = merged.filter((match) => {
    if (isMatchesTabLive(match.status_short)) return true
    if (match.is_final) return true
    if (isVoidMatchStatus(match.status_short)) return true
    return isWithinUpcomingHorizon(match.kickoff_at, nowMs)
  })

  return filtered.sort((a, b) => {
    const aLive = isMatchesTabLive(a.status_short)
    const bLive = isMatchesTabLive(b.status_short)
    if (aLive !== bLive) return aLive ? -1 : 1
    if (a.is_final !== b.is_final) return a.is_final ? 1 : -1
    return (
      new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    )
  })
}
