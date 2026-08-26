import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as browserSupabase } from '@/src/lib/supabase'

/** Default / primary competition while the product is still single-event. */
export const CURRENT_EVENT_SLUG = 'fifa-world-cup-2026'

export type SportingEvent = {
  id: string
  name: string
  slug: string
  sport: string
  status: string
  provider: string | null
  provider_league_id: string | null
  provider_season: string | null
  event_type: string
  start_date: string | null
  end_date: string | null
  logo_url: string | null
}

const SPORTING_EVENT_SELECT =
  'id, name, slug, sport, status, provider, provider_league_id, provider_season, event_type, start_date, end_date, logo_url'

/**
 * Resolve the "current" sporting event for writes that need event_id.
 *
 * Today: returns the World Cup by slug (only event in the catalog).
 * Later: extend to prefer status=live, user selection, or sport-specific defaults.
 */
export async function getCurrentEvent(
  client: SupabaseClient = browserSupabase,
): Promise<SportingEvent | null> {
  const { data: bySlug, error: slugError } = await client
    .from('sporting_events')
    .select(SPORTING_EVENT_SELECT)
    .eq('slug', CURRENT_EVENT_SLUG)
    .maybeSingle()

  if (slugError) {
    console.error('getCurrentEvent: slug lookup failed', slugError.message)
  }
  if (bySlug) return bySlug as SportingEvent

  const { data: live, error: liveError } = await client
    .from('sporting_events')
    .select(SPORTING_EVENT_SELECT)
    .eq('status', 'live')
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (liveError) {
    console.error('getCurrentEvent: live lookup failed', liveError.message)
  }
  if (live) return live as SportingEvent

  const { data: anyEvent, error: anyError } = await client
    .from('sporting_events')
    .select(SPORTING_EVENT_SELECT)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (anyError) {
    console.error('getCurrentEvent: fallback lookup failed', anyError.message)
  }

  return (anyEvent as SportingEvent | null) ?? null
}

/**
 * Resolve an event id for match/pool queries.
 * Pass `eventId` to target a specific competition; omit to use getCurrentEvent().
 */
export async function resolveCurrentEventId(
  client: SupabaseClient = browserSupabase,
  eventId?: string | null,
): Promise<string | null> {
  const trimmed = eventId?.trim()
  if (trimmed) return trimmed

  const current = await getCurrentEvent(client)
  return current?.id ?? null
}

const EVENT_STATUS_PRIORITY: Record<string, number> = {
  live: 0,
  upcoming: 1,
  scheduled: 2,
  completed: 3,
  finished: 3,
}

/**
 * All sporting events for dashboard pills, ordered live/upcoming first,
 * then completed. No synthetic "All" pill — each row is a real event.
 */
export async function listSportingEvents(
  client: SupabaseClient = browserSupabase,
): Promise<SportingEvent[]> {
  const { data, error } = await client
    .from('sporting_events')
    .select(SPORTING_EVENT_SELECT)

  if (error) {
    console.error('listSportingEvents failed', error.message)
    return []
  }

  const rows = (data ?? []) as SportingEvent[]
  return [...rows].sort((a, b) => {
    const pa = EVENT_STATUS_PRIORITY[a.status] ?? 50
    const pb = EVENT_STATUS_PRIORITY[b.status] ?? 50
    if (pa !== pb) return pa - pb
    const aStart = a.start_date ?? ''
    const bStart = b.start_date ?? ''
    if (aStart !== bStart) return bStart.localeCompare(aStart)
    return a.name.localeCompare(b.name)
  })
}

const CREATABLE_EVENT_STATUSES = ['live', 'upcoming'] as const

/**
 * Events available for new pool creation: status live or upcoming only.
 * Completed/finished leagues (e.g. finished World Cup) are excluded.
 * Ordered: live first, then upcoming by start_date ascending, then name.
 * Direct select — sporting_events is already client-readable (same as dashboard).
 */
export async function listCreatableSportingEvents(
  client: SupabaseClient = browserSupabase,
): Promise<SportingEvent[]> {
  const { data, error } = await client
    .from('sporting_events')
    .select(SPORTING_EVENT_SELECT)
    .in('status', [...CREATABLE_EVENT_STATUSES])

  if (error) {
    console.error('listCreatableSportingEvents failed', error.message)
    return []
  }

  const rows = (data ?? []) as SportingEvent[]
  return [...rows].sort((a, b) => {
    const pa = EVENT_STATUS_PRIORITY[a.status] ?? 50
    const pb = EVENT_STATUS_PRIORITY[b.status] ?? 50
    if (pa !== pb) return pa - pb
    const aStart = a.start_date ?? ''
    const bStart = b.start_date ?? ''
    if (aStart !== bStart) return aStart.localeCompare(bStart)
    return a.name.localeCompare(b.name)
  })
}

/** Short date range for create-flow event cards. */
export function formatSportingEventDateRange(
  startDate: string | null,
  endDate: string | null,
): string {
  const format = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }

  if (startDate && endDate) return `${format(startDate)} – ${format(endDate)}`
  if (startDate) return `Starts ${format(startDate)}`
  if (endDate) return `Ends ${format(endDate)}`
  return 'Dates TBA'
}

/**
 * Compact range for create-flow competition rows.
 * Long span / cross-year → "Aug 2026 – May 2027";
 * short same-year → "Oct 12 – Nov 8".
 */
export function formatSportingEventDateRangeCompact(
  startDate: string | null,
  endDate: string | null,
): string {
  const parse = (iso: string): Date | null => {
    const d = new Date(`${iso}T12:00:00Z`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const start = startDate ? parse(startDate) : null
  const end = endDate ? parse(endDate) : null

  if (!start && !end) return 'Dates TBA'

  const monthYear = (d: Date) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  const monthDay = (d: Date) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })

  if (start && !end) return monthYear(start)
  if (!start && end) return monthYear(end)

  const startMs = start!.getTime()
  const endMs = end!.getTime()
  const daySpan = Math.abs(endMs - startMs) / 86_400_000
  const sameYear = start!.getUTCFullYear() === end!.getUTCFullYear()

  if (!sameYear || daySpan > 90) {
    return `${monthYear(start!)} – ${monthYear(end!)}`
  }

  return `${monthDay(start!)} – ${monthDay(end!)}`
}
