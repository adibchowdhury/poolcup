import type { SupabaseClient } from '@supabase/supabase-js'
import {
  formatOfficialLeagueName,
  formatOfficialSeasonLabel,
  formatOfficialStatusLabel,
  joinPublicPool,
  type OfficialPoolListItem,
} from '@/src/lib/fetch-official-pools'
import { normalizeSportKey, sportDisplayLabel } from '@/src/lib/sport-display'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'

export { joinPublicPool, formatScoringStyleLabel }

/** Page size for the main official-pools list (load more). */
export const DISCOVER_PAGE_SIZE = 12

/** Trending section size. */
export const DISCOVER_TRENDING_LIMIT = 8

export type DiscoverSportFilterId =
  | 'all'
  | 'soccer'
  | 'basketball'
  | 'football'
  | 'hockey'
  | 'baseball'
  | 'cricket'

/** Sport chips on Discover — maps to normalized sporting_events.sport keys. */
export const DISCOVER_SPORT_FILTERS: Array<{
  id: DiscoverSportFilterId
  label: string
  /** null = all sports */
  sportKey: string | null
}> = [
  { id: 'all', label: 'All sports', sportKey: null },
  { id: 'soccer', label: 'Soccer', sportKey: 'football' },
  { id: 'basketball', label: 'Basketball', sportKey: 'basketball' },
  { id: 'football', label: 'Football', sportKey: 'american_football' },
  { id: 'hockey', label: 'Hockey', sportKey: 'hockey' },
  { id: 'baseball', label: 'Baseball', sportKey: 'baseball' },
  { id: 'cricket', label: 'Cricket', sportKey: 'cricket' },
]

export type DiscoverHost = {
  userId: string
  displayName: string
  avatar: string | null
  customAvatarUrl: string | null
}

export type DiscoverPoolCard = {
  id: string
  name: string
  inviteCode: string
  eventId: string | null
  eventName: string
  sport: string | null
  sportKey: string
  sportLabel: string
  seasonLabel: string | null
  eventStatus: string | null
  eventStartDate: string | null
  scoringStyle: string
  scoringLabel: string
  memberCount: number
  recentJoins?: number
  isMember: boolean
  host: DiscoverHost | null
}

export type DiscoverTrendingPool = DiscoverPoolCard & {
  recentJoins: number
}

export type DiscoverUpcomingCompetition = {
  eventId: string
  name: string
  sport: string | null
  sportLabel: string
  status: string
  startDate: string | null
  endDate: string | null
  officialPools: Array<{
    id: string
    name: string
    inviteCode: string
    isMember: boolean
  }>
}

type PoolRow = {
  id: string
  name: string
  invite_code: string
  event_id: string | null
  event_name: string | null
  scoring_style: string
  creator_id: string | null
}

type EventRow = {
  id: string
  name: string
  sport: string | null
  status: string
  start_date: string | null
  end_date: string | null
  provider_season: string | null
}

type UserRow = {
  id: string
  display_name: string | null
  avatar: string | null
  custom_avatar_url: string | null
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

function hostFromUser(row: UserRow | null | undefined): DiscoverHost | null {
  if (!row?.id) return null
  return {
    userId: row.id,
    displayName: row.display_name?.trim() || 'Host',
    avatar: row.avatar,
    customAvatarUrl: row.custom_avatar_url,
  }
}

function buildDiscoverCard(
  pool: PoolRow,
  event: EventRow | undefined,
  host: DiscoverHost | null,
  memberCount: number,
  isMember: boolean,
  recentJoins?: number,
): DiscoverPoolCard {
  const sport = event?.sport ?? null
  const sportKey = sport ? normalizeSportKey(sport) : 'football'
  const eventName =
    (event?.name ?? pool.event_name)?.trim() ||
    formatOfficialLeagueName(pool.event_name, pool.name)

  return {
    id: pool.id,
    name: pool.name,
    inviteCode: pool.invite_code,
    eventId: pool.event_id,
    eventName,
    sport,
    sportKey,
    sportLabel: sport ? sportDisplayLabel(sport) : 'Sport',
    seasonLabel: formatOfficialSeasonLabel(
      event?.provider_season,
      event?.start_date,
      event?.end_date,
    ),
    eventStatus: event?.status ?? null,
    eventStartDate: event?.start_date ?? null,
    scoringStyle: pool.scoring_style || 'classic',
    scoringLabel: formatScoringStyleLabel(pool.scoring_style || 'classic'),
    memberCount,
    recentJoins,
    isMember,
    host,
  }
}

/**
 * Official discoverable pools with event sport + host (creator) enrichment.
 */
export async function fetchDiscoverOfficialPools(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ pools: DiscoverPoolCard[]; error: string | null }> {
  const { data: poolRows, error: poolsError } = await supabase
    .from('pools')
    .select(
      'id, name, invite_code, event_id, event_name, scoring_style, creator_id',
    )
    .eq('is_official', true)
    .eq('is_public', true)
    .order('name', { ascending: true })

  if (poolsError) {
    console.error('fetchDiscoverOfficialPools:', poolsError.message)
    return { pools: [], error: poolsError.message }
  }

  const pools = (poolRows ?? []) as PoolRow[]
  if (pools.length === 0) return { pools: [], error: null }

  const poolIds = pools.map((p) => p.id)
  const eventIds = [
    ...new Set(
      pools
        .map((p) => p.event_id)
        .filter((id): id is string => Boolean(id?.trim())),
    ),
  ]
  const creatorIds = [
    ...new Set(
      pools
        .map((p) => p.creator_id)
        .filter((id): id is string => Boolean(id?.trim())),
    ),
  ]

  const [eventsResult, membersResult, myMembershipsResult, hostsResult] =
    await Promise.all([
      eventIds.length > 0
        ? supabase
            .from('sporting_events')
            .select(
              'id, name, sport, status, start_date, end_date, provider_season',
            )
            .in('id', eventIds)
        : Promise.resolve({ data: [] as EventRow[], error: null }),
      supabase.from('pool_members').select('pool_id').in('pool_id', poolIds),
      supabase
        .from('pool_members')
        .select('pool_id')
        .eq('user_id', userId)
        .in('pool_id', poolIds),
      creatorIds.length > 0
        ? supabase
            .from('users')
            .select('id, display_name, avatar, custom_avatar_url')
            .in('id', creatorIds)
        : Promise.resolve({ data: [] as UserRow[], error: null }),
    ])

  if (eventsResult.error) {
    console.error(
      'fetchDiscoverOfficialPools events:',
      eventsResult.error.message,
    )
  }
  if (membersResult.error) {
    console.error(
      'fetchDiscoverOfficialPools members:',
      membersResult.error.message,
    )
  }
  if (myMembershipsResult.error) {
    console.error(
      'fetchDiscoverOfficialPools my memberships:',
      myMembershipsResult.error.message,
    )
  }
  if (hostsResult.error) {
    console.error(
      'fetchDiscoverOfficialPools hosts:',
      hostsResult.error.message,
    )
  }

  const eventsById = new Map<string, EventRow>()
  for (const row of (eventsResult.data ?? []) as EventRow[]) {
    eventsById.set(row.id, row)
  }

  const hostsById = new Map<string, DiscoverHost>()
  for (const row of (hostsResult.data ?? []) as UserRow[]) {
    const host = hostFromUser(row)
    if (host) hostsById.set(host.userId, host)
  }

  const memberCounts = new Map<string, number>()
  for (const row of membersResult.data ?? []) {
    const id = row.pool_id as string
    memberCounts.set(id, (memberCounts.get(id) ?? 0) + 1)
  }

  const myPoolIds = new Set(
    (myMembershipsResult.data ?? []).map((row) => row.pool_id as string),
  )

  const items = pools.map((pool) => {
    const event = pool.event_id ? eventsById.get(pool.event_id) : undefined
    const host = pool.creator_id
      ? (hostsById.get(pool.creator_id) ?? null)
      : null
    return buildDiscoverCard(
      pool,
      event,
      host,
      memberCounts.get(pool.id) ?? 0,
      myPoolIds.has(pool.id),
    )
  })

  const statusRank = (status: string | null) => {
    const s = (status ?? '').toLowerCase()
    if (s === 'live') return 0
    if (s === 'upcoming' || s === 'scheduled') return 1
    if (s === 'completed' || s === 'finished') return 3
    return 2
  }

  items.sort((a, b) => {
    const ra = statusRank(a.eventStatus)
    const rb = statusRank(b.eventStatus)
    if (ra !== rb) return ra - rb
    return a.eventName.localeCompare(b.eventName)
  })

  return { pools: items, error: null }
}

/**
 * Trending = most members joined in the last 7 days (RPC),
 * tiebreak total member_count. Metric: recent_joins (7d).
 */
export async function fetchTrendingOfficialPools(
  supabase: SupabaseClient,
  userId: string,
  limit = DISCOVER_TRENDING_LIMIT,
): Promise<{ pools: DiscoverTrendingPool[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_trending_official_pools', {
    p_limit: limit,
  })

  if (error) {
    console.error('get_trending_official_pools failed:', error.message)
    return { pools: [], error: error.message }
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { pools: [], error: null }
  }

  const poolIds = data
    .map((row) => asString((row as Record<string, unknown>).pool_id))
    .filter((id): id is string => Boolean(id))

  const myPoolIds = new Set<string>()
  if (poolIds.length > 0) {
    const { data: memberships } = await supabase
      .from('pool_members')
      .select('pool_id')
      .eq('user_id', userId)
      .in('pool_id', poolIds)
    for (const row of memberships ?? []) {
      myPoolIds.add(row.pool_id as string)
    }
  }

  const pools: DiscoverTrendingPool[] = []
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const poolId = asString(row.pool_id)
    if (!poolId) continue

    const sport = asString(row.sport)
    const sportKey = sport ? normalizeSportKey(sport) : 'football'
    const eventName =
      asString(row.event_name)?.trim() ||
      asString(row.name)?.trim() ||
      'Competition'
    const scoringStyle = asString(row.scoring_style) || 'classic'
    const hostUserId = asString(row.host_user_id)
    const host: DiscoverHost | null = hostUserId
      ? {
          userId: hostUserId,
          displayName: asString(row.host_name)?.trim() || 'Host',
          avatar: asString(row.host_avatar),
          customAvatarUrl: asString(row.host_custom_avatar_url),
        }
      : null

    pools.push({
      id: poolId,
      name: asString(row.name)?.trim() || 'Official pool',
      inviteCode: asString(row.invite_code) || '',
      eventId: asString(row.event_id),
      eventName,
      sport,
      sportKey,
      sportLabel: sport ? sportDisplayLabel(sport) : 'Sport',
      seasonLabel: null,
      eventStatus: null,
      eventStartDate: null,
      scoringStyle,
      scoringLabel: formatScoringStyleLabel(scoringStyle),
      memberCount: Math.max(0, asNumber(row.member_count) ?? 0),
      recentJoins: Math.max(0, asNumber(row.recent_joins) ?? 0),
      isMember: myPoolIds.has(poolId),
      host,
    })
  }

  return { pools, error: null }
}

/**
 * Live + upcoming competitions with linked official pools (if any).
 */
export async function fetchDiscoverUpcomingCompetitions(
  supabase: SupabaseClient,
  _userId: string,
  officialPools: DiscoverPoolCard[],
): Promise<{ events: DiscoverUpcomingCompetition[]; error: string | null }> {
  const { data, error } = await supabase
    .from('sporting_events')
    .select('id, name, sport, status, start_date, end_date')
    .in('status', ['live', 'upcoming', 'scheduled'])
    .order('start_date', { ascending: true })

  if (error) {
    console.error('fetchDiscoverUpcomingCompetitions:', error.message)
    return { events: [], error: error.message }
  }

  const poolsByEvent = new Map<string, DiscoverPoolCard[]>()
  for (const pool of officialPools) {
    if (!pool.eventId) continue
    const list = poolsByEvent.get(pool.eventId) ?? []
    list.push(pool)
    poolsByEvent.set(pool.eventId, list)
  }

  const events: DiscoverUpcomingCompetition[] = (data ?? []).map((row) => {
    const sport = (row.sport as string | null) ?? null
    const linked = poolsByEvent.get(row.id as string) ?? []
    return {
      eventId: row.id as string,
      name: ((row.name as string) || 'Competition').trim(),
      sport,
      sportLabel: sport ? sportDisplayLabel(sport) : 'Sport',
      status: (row.status as string) || 'upcoming',
      startDate: (row.start_date as string | null) ?? null,
      endDate: (row.end_date as string | null) ?? null,
      officialPools: linked.map((p) => ({
        id: p.id,
        name: p.name,
        inviteCode: p.inviteCode,
        isMember: p.isMember,
      })),
    }
  })

  // Prefer live first, then soonest start.
  events.sort((a, b) => {
    const ra = a.status === 'live' ? 0 : 1
    const rb = b.status === 'live' ? 0 : 1
    if (ra !== rb) return ra - rb
    return (a.startDate ?? '').localeCompare(b.startDate ?? '')
  })

  return { events, error: null }
}

export function sportFilterKey(
  sportId: DiscoverSportFilterId,
): string | null {
  return (
    DISCOVER_SPORT_FILTERS.find((s) => s.id === sportId)?.sportKey ?? null
  )
}

export function filterDiscoverPools(
  pools: DiscoverPoolCard[],
  options: {
    sportId: DiscoverSportFilterId
    eventId: string | null
    query: string
  },
): DiscoverPoolCard[] {
  const sportKey = sportFilterKey(options.sportId)
  const q = options.query.trim().toLowerCase()

  return pools.filter((pool) => {
    if (sportKey && pool.sportKey !== sportKey) return false
    if (options.eventId && pool.eventId !== options.eventId) return false
    if (q) {
      const hay = `${pool.name} ${pool.eventName} ${pool.sportLabel}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** Unique competitions for the competition filter (optionally scoped by sport). */
export function discoverCompetitionOptions(
  pools: DiscoverPoolCard[],
  sportId: DiscoverSportFilterId,
): Array<{ eventId: string; label: string }> {
  const sportKey = sportFilterKey(sportId)
  const map = new Map<string, string>()
  for (const pool of pools) {
    if (!pool.eventId) continue
    if (sportKey && pool.sportKey !== sportKey) continue
    if (!map.has(pool.eventId)) map.set(pool.eventId, pool.eventName)
  }
  return [...map.entries()]
    .map(([eventId, label]) => ({ eventId, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function formatDiscoverStatus(
  status: string | null | undefined,
  startDate: string | null | undefined,
): ReturnType<typeof formatOfficialStatusLabel> {
  return formatOfficialStatusLabel(status, startDate)
}

/** Adapt DiscoverPoolCard → OfficialPoolListItem shape if needed by shared UI. */
export function toOfficialListItem(
  pool: DiscoverPoolCard,
): OfficialPoolListItem {
  return {
    id: pool.id,
    name: pool.name,
    inviteCode: pool.inviteCode,
    eventId: pool.eventId,
    leagueName: formatOfficialLeagueName(pool.eventName, pool.name),
    seasonLabel: pool.seasonLabel,
    eventStatus: pool.eventStatus,
    eventStartDate: pool.eventStartDate,
    scoringStyle: pool.scoringStyle,
    memberCount: pool.memberCount,
    isMember: pool.isMember,
  }
}
