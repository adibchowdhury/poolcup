import type { SupabaseClient } from '@supabase/supabase-js'
import {
  FEATURED_LIVE_STATUS_SHORTS,
  type FeaturedMatch,
  type FeaturedMatchMode,
} from '@/src/lib/featured-match'

const FEATURED_MATCH_COLUMNS =
  'id, team1_name, team2_name, team1_flag, team2_flag, result_team1, result_team2, status_short, elapsed_minute, kickoff_at, group_name, round, is_final'

/** Max cards in the dashboard event-pill match slider (per event). */
export const EVENT_SLIDER_MATCH_LIMIT = 20

/**
 * TEMPORARY — Event pill slider currently includes COMPLETED / historical matches
 * so the UI is populated while both WC and CL are finished seasons.
 *
 * LATER: set this to `false` (or delete the completed branch in
 * `filterEventSliderMatches`) so the slider shows LIVE + UPCOMING only.
 * One-line flip when live prediction seasons resume.
 */
export const EVENT_SLIDER_INCLUDE_COMPLETED_TEMPORARY = true

export type EventSliderMatch = FeaturedMatch & {
  mode: FeaturedMatchMode
}

function isLiveStatus(statusShort: string | null): boolean {
  const status = (statusShort ?? '').trim().toUpperCase()
  return (FEATURED_LIVE_STATUS_SHORTS as readonly string[]).includes(status)
}

/**
 * TEMPORARY filter: keep all statuses when INCLUDE_COMPLETED is true.
 * Later (INCLUDE_COMPLETED false): keep only live + upcoming (kickoff in future, not final).
 */
export function filterEventSliderMatches(
  matches: FeaturedMatch[],
  nowMs: number = Date.now(),
): FeaturedMatch[] {
  if (EVENT_SLIDER_INCLUDE_COMPLETED_TEMPORARY) {
    return matches
  }

  // --- LIVE + UPCOMING ONLY (enable when EVENT_SLIDER_INCLUDE_COMPLETED_TEMPORARY = false) ---
  return matches.filter((match) => {
    if (match.is_final) return false
    if (isLiveStatus(match.status_short)) return true
    const kickoffMs = new Date(match.kickoff_at).getTime()
    return kickoffMs > nowMs
  })
}

function deriveSliderMode(
  match: FeaturedMatch,
  nowMs: number,
): FeaturedMatchMode {
  if (match.is_final) return 'final'
  if (isLiveStatus(match.status_short)) return 'live'
  const kickoffMs = new Date(match.kickoff_at).getTime()
  if (kickoffMs > nowMs) return 'upcoming'
  if (!match.is_final && kickoffMs <= nowMs) return 'live'
  return 'final'
}

/** Sort: live → upcoming (soonest first) → completed (most recent first). */
export function sortEventSliderMatches(
  matches: FeaturedMatch[],
  nowMs: number = Date.now(),
): EventSliderMatch[] {
  const withMode = matches.map((match) => ({
    ...match,
    mode: deriveSliderMode(match, nowMs),
  }))

  const rank = (mode: FeaturedMatchMode) =>
    mode === 'live' ? 0 : mode === 'upcoming' ? 1 : 2

  return withMode.sort((a, b) => {
    const ra = rank(a.mode)
    const rb = rank(b.mode)
    if (ra !== rb) return ra - rb

    const aKick = new Date(a.kickoff_at).getTime()
    const bKick = new Date(b.kickoff_at).getTime()

    if (a.mode === 'upcoming') return aKick - bKick
    // live + final: most recent kickoff first
    return bKick - aKick
  })
}

/**
 * Fetch matches for one sporting event for the dashboard pill slider.
 * Ordered live → upcoming → recent completed (see sortEventSliderMatches).
 */
export async function fetchEventSliderMatches(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventSliderMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(FEATURED_MATCH_COLUMNS)
    .eq('event_id', eventId)
    .order('kickoff_at', { ascending: false })
    .limit(200)

  if (error) {
    throw new Error(error.message)
  }

  const nowMs = Date.now()
  const filtered = filterEventSliderMatches(
    (data ?? []) as FeaturedMatch[],
    nowMs,
  )
  return sortEventSliderMatches(filtered, nowMs).slice(
    0,
    EVENT_SLIDER_MATCH_LIMIT,
  )
}
