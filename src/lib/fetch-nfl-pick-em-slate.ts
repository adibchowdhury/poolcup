import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { normalizeTeamLogoUrl } from '@/src/lib/team-logos'

/** NFL 2026 sporting_events.id — same event as create-wizard `?event=nfl-2026`. */
export const NFL_2026_EVENT_ID = 'eea86f2b-a0e2-46df-8f3a-688dfbd7ff10'

/**
 * Full Week 1 slate is 16 games (Thu opener → Mon night). Cap here so we
 * never spill into Week 2 when querying upcoming-only.
 */
export const NFL_PICK_EM_SLATE_LIMIT = 16

export type NflPickEmSlateMatch = {
  id: string
  kickoff_at: string
  team1_name: string
  team2_name: string
  team1_logo: string | null
  team2_logo: string | null
}

/**
 * Upcoming NFL slate for the marketing page.
 * Uses cookie-aware anon server client (no auth required — `matches_read`
 * is SELECT TO public USING (true)). Root layout `headers()` + this client's
 * `cookies()` keep the route dynamic; `revalidate` on the page is moot.
 */
export async function fetchNflPickEmSlate(): Promise<NflPickEmSlateMatch[]> {
  const supabase = await createServerSupabaseClient()
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, kickoff_at, team1_name, team2_name, team1_logo, team2_logo',
    )
    .eq('event_id', NFL_2026_EVENT_ID)
    .gt('kickoff_at', nowIso)
    .order('kickoff_at', { ascending: true })
    .limit(NFL_PICK_EM_SLATE_LIMIT)

  if (error) {
    console.error('fetchNflPickEmSlate failed', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    kickoff_at: row.kickoff_at,
    team1_name: row.team1_name,
    team2_name: row.team2_name,
    team1_logo: normalizeTeamLogoUrl(row.team1_logo),
    team2_logo: normalizeTeamLogoUrl(row.team2_logo),
  }))
}

/**
 * Static NFL kickoff label for anonymous marketing visitors.
 * Always America/New_York (ET), zone labeled — never visitor-local TZ.
 * Example: "Wed, Sep 9 · 8:20 PM ET"
 */
export function formatNflKickoffEt(iso: string): string {
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
export function nflTeamInitials(teamName: string): string {
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
