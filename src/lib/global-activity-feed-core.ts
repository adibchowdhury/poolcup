import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Aggregate pool activity for the dashboard rail — counts only, no personal attribution.
 * Person-specific activity belongs in the friends feed (accepted friends only).
 * If identity is ever added to a future item type, use username only — never display names.
 */

/** Picks counted in the last N hours (headline: "today"). */
export const GLOBAL_ACTIVITY_PICKS_WINDOW_HOURS = 24

/** Pool creations and join rollups use this window (headline: "this week"). */
export const GLOBAL_ACTIVITY_WEEK_DAYS = 7

/** Upcoming match counts look this many days ahead. */
export const GLOBAL_ACTIVITY_UPCOMING_MATCH_DAYS = 7

/** Rows shown on dashboard rail / feed section. */
export const GLOBAL_ACTIVITY_DASHBOARD_LIMIT = 4

/** Rows shown on /activity page. */
export const GLOBAL_ACTIVITY_PAGE_LIMIT = 8

/** Fewer than this many aggregate rows → sparse hint. */
export const GLOBAL_ACTIVITY_SPARSE_THRESHOLD = 2

export const COMPLETED_EVENT_STATUSES = ['completed', 'finished'] as const

export type GlobalActivityItemType =
  | 'picks_summary'
  | 'pools_created_summary'
  | 'pool_joins_summary'
  | 'upcoming_matches'

export type GlobalActivityItem = {
  id: string
  type: GlobalActivityItemType
  /** Pre-formatted copy — no usernames or display names. */
  headline: string
  /** Window label, e.g. "Today" or "This week". */
  subline: string
  /** For sort order / relative time display. */
  occurredAt: string
  /** Optional deep link for pool-scoped items. */
  poolInviteCode?: string | null
}

export type GlobalActivityFeedResult = {
  items: GlobalActivityItem[]
  isSparse: boolean
  isEmpty: boolean
}

type ActiveEvent = {
  id: string
  name: string
  status: string
}

type JoinRow = {
  joined_at: string
  pool_id: string
  pools: { name: string; invite_code: string } | null
}

type MatchRow = {
  kickoff_at: string
  event_id: string
  sporting_events: { name: string } | null
}

function hoursAgoIso(hours: number, now = Date.now()): string {
  return new Date(now - hours * 3_600_000).toISOString()
}

function daysAgoIso(days: number, now = Date.now()): string {
  return new Date(now - days * 86_400_000).toISOString()
}

function daysAheadIso(days: number, now = Date.now()): string {
  return new Date(now + days * 86_400_000).toISOString()
}

async function loadActiveEvents(
  supabase: SupabaseClient,
): Promise<ActiveEvent[]> {
  const { data, error } = await supabase
    .from('sporting_events')
    .select('id, name, status')

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).filter(
    (row) =>
      !COMPLETED_EVENT_STATUSES.includes(
        row.status as (typeof COMPLETED_EVENT_STATUSES)[number],
      ),
  ) as ActiveEvent[]
}

async function countRecentPicks(
  supabase: SupabaseClient,
  activeEventIds: string[],
  sinceIso: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('predictions')
    .select('id, pools!inner(event_id)', { count: 'exact', head: true })
    .in('pools.event_id', activeEventIds)
    .gte('submitted_at', sinceIso)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

async function countRecentPools(
  supabase: SupabaseClient,
  activeEventIds: string[],
  sinceIso: string,
): Promise<{ count: number; latestAt: string | null }> {
  const { count, error: countError } = await supabase
    .from('pools')
    .select('id', { count: 'exact', head: true })
    .in('event_id', activeEventIds)
    .gte('created_at', sinceIso)

  if (countError) {
    throw new Error(countError.message)
  }

  const { data: latest, error: latestError } = await supabase
    .from('pools')
    .select('created_at')
    .in('event_id', activeEventIds)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) {
    throw new Error(latestError.message)
  }

  return {
    count: count ?? 0,
    latestAt: (latest?.created_at as string | undefined) ?? null,
  }
}

async function topPoolJoinSummary(
  supabase: SupabaseClient,
  activeEventIds: string[],
  sinceIso: string,
  maxPools: number,
): Promise<
  Array<{
    poolName: string
    inviteCode: string
    joinCount: number
    latestAt: string
  }>
> {
  const { data, error } = await supabase
    .from('pool_members')
    .select('joined_at, pool_id, pools!inner(name, invite_code, event_id)')
    .in('pools.event_id', activeEventIds)
    .gte('joined_at', sinceIso)
    .order('joined_at', { ascending: false })
    .limit(500)

  if (error) {
    throw new Error(error.message)
  }

  const byPool = new Map<
    string,
    { poolName: string; inviteCode: string; joinCount: number; latestAt: string }
  >()

  for (const row of (data ?? []) as unknown as JoinRow[]) {
    const pool = row.pools
    if (!pool?.name || !pool.invite_code) continue

    const existing = byPool.get(row.pool_id)
    if (existing) {
      existing.joinCount += 1
      if (row.joined_at > existing.latestAt) {
        existing.latestAt = row.joined_at
      }
      continue
    }

    byPool.set(row.pool_id, {
      poolName: pool.name,
      inviteCode: pool.invite_code,
      joinCount: 1,
      latestAt: row.joined_at,
    })
  }

  return [...byPool.values()]
    .sort((a, b) => b.joinCount - a.joinCount || b.latestAt.localeCompare(a.latestAt))
    .slice(0, maxPools)
}

async function topUpcomingEventMatchSummary(
  supabase: SupabaseClient,
  activeEvents: ActiveEvent[],
  nowIso: string,
  untilIso: string,
): Promise<{ eventName: string; matchCount: number; nextKickoff: string } | null> {
  const activeIds = activeEvents.map((e) => e.id)
  if (activeIds.length === 0) return null

  const { data, error } = await supabase
    .from('matches')
    .select('kickoff_at, event_id, sporting_events(name)')
    .in('event_id', activeIds)
    .gte('kickoff_at', nowIso)
    .lte('kickoff_at', untilIso)
    .order('kickoff_at', { ascending: true })
    .limit(500)

  if (error) {
    throw new Error(error.message)
  }

  const byEvent = new Map<
    string,
    { eventName: string; matchCount: number; nextKickoff: string }
  >()

  for (const row of (data ?? []) as unknown as MatchRow[]) {
    const eventName =
      row.sporting_events?.name ??
      activeEvents.find((e) => e.id === row.event_id)?.name ??
      'League'
    const existing = byEvent.get(row.event_id)
    if (existing) {
      existing.matchCount += 1
      continue
    }
    byEvent.set(row.event_id, {
      eventName,
      matchCount: 1,
      nextKickoff: row.kickoff_at,
    })
  }

  const liveIds = new Set(
    activeEvents.filter((e) => e.status === 'live').map((e) => e.id),
  )

  const ranked = [...byEvent.entries()].sort((a, b) => {
    const aLive = liveIds.has(a[0]) ? 1 : 0
    const bLive = liveIds.has(b[0]) ? 1 : 0
    if (aLive !== bLive) return bLive - aLive
    return b[1].matchCount - a[1].matchCount
  })

  return ranked[0]?.[1] ?? null
}

function picksHeadline(count: number): string {
  const label = count === 1 ? '1 pick' : `${count.toLocaleString()} picks`
  return `${label} made across pools today`
}

function poolsCreatedHeadline(count: number): string {
  const label = count === 1 ? '1 new pool' : `${count.toLocaleString()} new pools`
  return `${label} created this week`
}

function poolJoinsHeadline(count: number, poolName: string): string {
  const players = count === 1 ? '1 player' : `${count.toLocaleString()} players`
  return `${players} joined ${poolName}`
}

function upcomingMatchesHeadline(eventName: string, count: number): string {
  const matches = count === 1 ? '1 match' : `${count.toLocaleString()} matches`
  return `${eventName}: ${matches} this week`
}

export async function buildGlobalActivityFeed(
  supabase: SupabaseClient,
  options?: { limit?: number; now?: number },
): Promise<GlobalActivityFeedResult> {
  const limit = options?.limit ?? GLOBAL_ACTIVITY_DASHBOARD_LIMIT
  const now = options?.now ?? Date.now()
  const nowIso = new Date(now).toISOString()
  const picksSince = hoursAgoIso(GLOBAL_ACTIVITY_PICKS_WINDOW_HOURS, now)
  const weekSince = daysAgoIso(GLOBAL_ACTIVITY_WEEK_DAYS, now)
  const matchesUntil = daysAheadIso(GLOBAL_ACTIVITY_UPCOMING_MATCH_DAYS, now)

  const activeEvents = await loadActiveEvents(supabase)
  const activeIds = activeEvents.map((e) => e.id)

  if (activeIds.length === 0) {
    return { items: [], isSparse: true, isEmpty: true }
  }

  const [pickCount, poolsCreated, topJoinPools, upcoming] = await Promise.all([
    countRecentPicks(supabase, activeIds, picksSince),
    countRecentPools(supabase, activeIds, weekSince),
    topPoolJoinSummary(supabase, activeIds, weekSince, limit),
    topUpcomingEventMatchSummary(supabase, activeEvents, nowIso, matchesUntil),
  ])

  const items: GlobalActivityItem[] = []

  if (pickCount > 0) {
    items.push({
      id: 'picks-summary',
      type: 'picks_summary',
      headline: picksHeadline(pickCount),
      subline: 'Today',
      occurredAt: nowIso,
    })
  }

  for (const pool of topJoinPools) {
    items.push({
      id: `joins:${pool.inviteCode}`,
      type: 'pool_joins_summary',
      headline: poolJoinsHeadline(pool.joinCount, pool.poolName),
      subline: 'This week',
      occurredAt: pool.latestAt,
      poolInviteCode: pool.inviteCode,
    })
  }

  if (poolsCreated.count > 0) {
    items.push({
      id: 'pools-created-summary',
      type: 'pools_created_summary',
      headline: poolsCreatedHeadline(poolsCreated.count),
      subline: 'This week',
      occurredAt: poolsCreated.latestAt ?? weekSince,
    })
  }

  if (upcoming && upcoming.matchCount > 0) {
    items.push({
      id: `upcoming:${upcoming.eventName}`,
      type: 'upcoming_matches',
      headline: upcomingMatchesHeadline(upcoming.eventName, upcoming.matchCount),
      subline: 'Next 7 days',
      occurredAt: upcoming.nextKickoff,
    })
  }

  items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))

  const visible = items.slice(0, limit)

  return {
    items: visible,
    isSparse:
      visible.length > 0 && visible.length < GLOBAL_ACTIVITY_SPARSE_THRESHOLD,
    isEmpty: visible.length === 0,
  }
}
