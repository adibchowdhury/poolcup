import type { SupabaseClient } from '@supabase/supabase-js'
import {
  FEATURED_LIVE_STATUS_SHORTS,
  type FeaturedMatch,
  type FeaturedMatchMode,
} from '@/src/lib/featured-match'
import {
  getUpcomingHorizonEndIso,
  isBeyondUpcomingHorizon,
  isWithinUpcomingHorizon,
} from '@/src/lib/upcoming-match-horizon'

const FEATURED_MATCH_COLUMNS =
  'id, team1_name, team2_name, team1_flag, team2_flag, team1_logo, team2_logo, result_team1, result_team2, status_short, elapsed_minute, kickoff_at, group_name, round, is_final'

/** Max cards in the dashboard event-pill match slider (per event). */
export const EVENT_SLIDER_MATCH_LIMIT = 20

/**
 * TEMPORARY — Event pill slider currently includes COMPLETED / historical matches
 * so the UI is populated while seasons have recent results alongside upcoming.
 *
 * LATER: set this to `false` so the slider shows LIVE + UPCOMING only.
 * Upcoming is always capped at UPCOMING_HORIZON_DAYS regardless.
 * One-line flip when live prediction seasons resume.
 *
 * NOTE: completed matches do NOT qualify an event for a pill — only live or
 * upcoming-within-horizon do (see fetchInHorizonEventIds).
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
 * Safety-net filter for slider rows.
 * - Live: always keep
 * - Upcoming (kickoff > now): keep ONLY if within UPCOMING_HORIZON_DAYS
 * - Past / final: keep only when TEMPORARY completed flag is on
 */
export function filterEventSliderMatches(
  matches: FeaturedMatch[],
  nowMs: number = Date.now(),
): FeaturedMatch[] {
  return matches.filter((match) => {
    if (isLiveStatus(match.status_short)) return true

    const kickoffMs = new Date(match.kickoff_at).getTime()
    if (!Number.isFinite(kickoffMs)) return false

    // Future kickoff → upcoming horizon only (never keep >30d out).
    if (kickoffMs > nowMs) {
      if (isBeyondUpcomingHorizon(match.kickoff_at, nowMs)) return false
      return isWithinUpcomingHorizon(match.kickoff_at, nowMs)
    }

    // Past / started / final
    if (match.is_final || kickoffMs <= nowMs) {
      return EVENT_SLIDER_INCLUDE_COMPLETED_TEMPORARY
    }

    return false
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

function dedupeMatchesById(matches: FeaturedMatch[]): FeaturedMatch[] {
  const seen = new Set<string>()
  const out: FeaturedMatch[] = []
  for (const match of matches) {
    if (seen.has(match.id)) continue
    seen.add(match.id)
    out.push(match)
  }
  return out
}

/**
 * Batched (2 queries total — not N+1): event ids that have ≥1 in-horizon match
 * for pill visibility — live now, OR upcoming with kickoff ≤ now+30d.
 * Completed-only events (WC/CL historical) are intentionally excluded.
 */
export async function fetchInHorizonEventIds(
  supabase: SupabaseClient,
  nowMs: number = Date.now(),
): Promise<Set<string>> {
  const nowIso = new Date(nowMs).toISOString()
  const horizonEndIso = getUpcomingHorizonEndIso(nowMs)

  const [liveResult, upcomingResult] = await Promise.all([
    supabase
      .from('matches')
      .select('event_id')
      .in('status_short', [...FEATURED_LIVE_STATUS_SHORTS])
      .eq('is_final', false)
      .not('event_id', 'is', null),
    supabase
      .from('matches')
      .select('event_id')
      .gt('kickoff_at', nowIso)
      .lte('kickoff_at', horizonEndIso)
      .eq('is_final', false)
      .not('event_id', 'is', null),
  ])

  if (liveResult.error) {
    throw new Error(liveResult.error.message)
  }
  if (upcomingResult.error) {
    throw new Error(upcomingResult.error.message)
  }

  const ids = new Set<string>()
  for (const row of liveResult.data ?? []) {
    const id = (row as { event_id: string | null }).event_id
    if (id) ids.add(id)
  }
  for (const row of upcomingResult.data ?? []) {
    const id = (row as { event_id: string | null }).event_id
    if (id) ids.add(id)
  }
  return ids
}

/**
 * Fetch matches for one sporting event for the dashboard pill slider.
 * Upcoming rows are constrained at query time to UPCOMING_HORIZON_DAYS
 * (never fetches >30d-out fixtures as upcoming).
 */
export async function fetchEventSliderMatches(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventSliderMatch[]> {
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const horizonEndIso = getUpcomingHorizonEndIso(nowMs)

  const liveQuery = supabase
    .from('matches')
    .select(FEATURED_MATCH_COLUMNS)
    .eq('event_id', eventId)
    .in('status_short', [...FEATURED_LIVE_STATUS_SHORTS])
    .eq('is_final', false)
    .order('kickoff_at', { ascending: false })
    .limit(EVENT_SLIDER_MATCH_LIMIT)

  // Query-level horizon: only upcoming kickoffs in (now, now+30d].
  const upcomingQuery = supabase
    .from('matches')
    .select(FEATURED_MATCH_COLUMNS)
    .eq('event_id', eventId)
    .gt('kickoff_at', nowIso)
    .lte('kickoff_at', horizonEndIso)
    .eq('is_final', false)
    .order('kickoff_at', { ascending: true })
    .limit(EVENT_SLIDER_MATCH_LIMIT)

  const completedQuery = EVENT_SLIDER_INCLUDE_COMPLETED_TEMPORARY
    ? supabase
        .from('matches')
        .select(FEATURED_MATCH_COLUMNS)
        .eq('event_id', eventId)
        .eq('is_final', true)
        .order('kickoff_at', { ascending: false })
        .limit(EVENT_SLIDER_MATCH_LIMIT)
    : null

  const [liveResult, upcomingResult, completedResult] = await Promise.all([
    liveQuery,
    upcomingQuery,
    completedQuery,
  ])

  if (liveResult.error) throw new Error(liveResult.error.message)
  if (upcomingResult.error) throw new Error(upcomingResult.error.message)
  if (completedResult?.error) throw new Error(completedResult.error.message)

  const merged = dedupeMatchesById([
    ...((liveResult.data ?? []) as FeaturedMatch[]),
    ...((upcomingResult.data ?? []) as FeaturedMatch[]),
    ...((completedResult?.data ?? []) as FeaturedMatch[]),
  ])

  const filtered = filterEventSliderMatches(merged, nowMs)
  return sortEventSliderMatches(filtered, nowMs).slice(
    0,
    EVENT_SLIDER_MATCH_LIMIT,
  )
}
