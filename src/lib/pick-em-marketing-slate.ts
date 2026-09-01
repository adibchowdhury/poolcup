import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { normalizeTeamLogoUrl } from '@/src/lib/team-logos'

export type PickEmSlateMatch = {
  id: string
  kickoff_at: string
  team1_name: string
  team2_name: string
  team1_logo: string | null
  team2_logo: string | null
}

type SportingEventRow = {
  id: string
  status: string
  start_date: string | null
  end_date: string | null
}

export type PickEmSlateFetchResult = {
  matches: PickEmSlateMatch[]
  /** False when sporting_events row for the slug is not seeded yet. */
  eventExists: boolean
  /** True when the event exists but the calendar window is outside live play. */
  isOffseason: boolean
}

/**
 * Upcoming slate for a pick'em marketing page, resolved by sporting_events.slug.
 * Strict freshness: only kickoff_at > now. Completed games never linger.
 */
export async function fetchPickEmSlateByEventSlug(
  eventSlug: string,
  limit = 24,
): Promise<PickEmSlateFetchResult> {
  const supabase = await createServerSupabaseClient()
  const now = new Date()
  const nowIso = now.toISOString()

  const { data: event, error: eventError } = await supabase
    .from('sporting_events')
    .select('id, status, start_date, end_date')
    .eq('slug', eventSlug)
    .maybeSingle()

  if (eventError) {
    console.error('fetchPickEmSlateByEventSlug event lookup failed', eventError.message)
    return { matches: [], eventExists: false, isOffseason: false }
  }

  if (!event) {
    return { matches: [], eventExists: false, isOffseason: false }
  }

  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, kickoff_at, team1_name, team2_name, team1_logo, team2_logo',
    )
    .eq('event_id', event.id)
    .gt('kickoff_at', nowIso)
    .order('kickoff_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('fetchPickEmSlateByEventSlug matches failed', error.message)
    return {
      matches: [],
      eventExists: true,
      isOffseason: isPickEmOffseason(event, now),
    }
  }

  const matches = (data ?? []).map((row) => ({
    id: row.id,
    kickoff_at: row.kickoff_at,
    team1_name: row.team1_name,
    team2_name: row.team2_name,
    team1_logo: normalizeTeamLogoUrl(row.team1_logo),
    team2_logo: normalizeTeamLogoUrl(row.team2_logo),
  }))

  return {
    matches,
    eventExists: true,
    isOffseason:
      matches.length === 0 ? isPickEmOffseason(event, now) : false,
  }
}

function isPickEmOffseason(event: SportingEventRow, now: Date): boolean {
  if (event.status === 'completed' || event.status === 'ended') {
    return true
  }

  if (event.end_date) {
    const end = new Date(event.end_date)
    if (!Number.isNaN(end.getTime()) && now > end) {
      return true
    }
  }

  // Jan–July before kickoff: evergreen offseason copy for college football.
  const month = now.getUTCMonth()
  if (month <= 6 && event.start_date) {
    const start = new Date(event.start_date)
    if (!Number.isNaN(start.getTime()) && now < start) {
      return true
    }
  }

  return false
}

/**
 * Static kickoff label for anonymous marketing visitors.
 * Always America/New_York (ET), zone labeled — never visitor-local TZ.
 */
export function formatPickEmKickoffEt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)

  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)

  return `${datePart} · ${timePart} ET`
}

/** Compact monogram when crest URL is missing (server-safe; no onError). */
export function pickEmTeamInitials(teamName: string): string {
  const parts = teamName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  const first = parts[0]![0] ?? ''
  const last = parts[parts.length - 1]![0] ?? ''
  return `${first}${last}`.toUpperCase()
}
