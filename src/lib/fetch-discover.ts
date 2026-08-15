import type { SupabaseClient } from '@supabase/supabase-js'
import { joinPublicPool } from '@/src/lib/fetch-official-pools'
import { sportDisplayLabel } from '@/src/lib/sport-display'

export { joinPublicPool }

/** Preview cap per section (matches RPC default). */
export const DISCOVER_SECTION_CAP = 4

/** Page size for See-all pagination. */
export const DISCOVER_SECTION_PAGE_SIZE = 30

/** How many official / public pools to pull for Discover search. */
export const DISCOVER_SEARCH_FETCH_LIMIT = 100

/** Sport chips on Discover (RPC section keys: `sport:<id>`). */
export type DiscoverSportId =
  | 'soccer'
  | 'basketball'
  | 'american_football'
  | 'hockey'
  | 'baseball'

export const DISCOVER_SPORT_FILTERS: Array<{
  id: DiscoverSportId
  label: string
  iconPng: string
}> = [
  { id: 'soccer', label: 'Soccer', iconPng: 'soccer.png' },
  { id: 'basketball', label: 'Basketball', iconPng: 'basketball.png' },
  { id: 'american_football', label: 'Football', iconPng: 'football.png' },
  { id: 'hockey', label: 'Hockey', iconPng: 'hockey.png' },
  { id: 'baseball', label: 'Baseball', iconPng: 'baseball.png' },
]

export type DiscoverSectionKey =
  | 'official'
  | 'public'
  | 'trending'
  | `sport:${string}`

export type DiscoverPoolCard = {
  id: string
  name: string
  avatar: string | null
  emblemUrl: string | null
  themeColor: string | null
  isOfficial: boolean
  isPublic: boolean
  eventId: string | null
  sport: string | null
  sportLabel: string
  eventName: string
  memberCount: number
  recentJoins: number
  inviteCode: string
  isMember: boolean
}

export type DiscoverSportBucket = {
  sport: string
  sportLabel: string
  pools: DiscoverPoolCard[]
}

export type DiscoverSectionsPayload = {
  official: DiscoverPoolCard[]
  public: DiscoverPoolCard[]
  trending: DiscoverPoolCard[]
  bySport: DiscoverSportBucket[]
}

/** Preferred sport order for “Pools by sport”; unknowns follow by pool count. */
const SPORT_ORDER = [
  'soccer',
  'football',
  'american_football',
  'basketball',
  'baseball',
  'hockey',
  'cricket',
  'tennis',
  'volleyball',
] as const

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

function asBoolean(value: unknown): boolean {
  return value === true
}

function parseRpcPool(raw: unknown): DiscoverPoolCard | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = asString(row.id)
  if (!id) return null
  const sport = asString(row.sport)
  return {
    id,
    name: asString(row.name)?.trim() || 'Pool',
    avatar: asString(row.avatar),
    emblemUrl: asString(row.emblem_url),
    themeColor: asString(row.theme_color),
    isOfficial: asBoolean(row.is_official),
    isPublic: asBoolean(row.is_public),
    eventId: asString(row.event_id),
    sport,
    sportLabel: sport ? sportDisplayLabel(sport) : 'Sport',
    eventName: asString(row.event_name)?.trim() || 'Competition',
    memberCount: Math.max(0, asNumber(row.member_count) ?? 0),
    recentJoins: Math.max(0, asNumber(row.recent_joins) ?? 0),
    inviteCode: asString(row.invite_code)?.trim() || '',
    isMember: asBoolean(row.is_member),
  }
}

function parsePoolList(raw: unknown): DiscoverPoolCard[] {
  if (!Array.isArray(raw)) return []
  const out: DiscoverPoolCard[] = []
  for (const item of raw) {
    const pool = parseRpcPool(item)
    if (pool) out.push(pool)
  }
  return out
}

/**
 * RPC rows omit invite_code / is_member — enrich so Join/Open keep working.
 */
async function enrichDiscoverPools(
  supabase: SupabaseClient,
  userId: string,
  pools: DiscoverPoolCard[],
): Promise<DiscoverPoolCard[]> {
  if (pools.length === 0) return pools

  const poolIds = [...new Set(pools.map((p) => p.id))]
  const [poolsResult, membershipsResult] = await Promise.all([
    supabase.from('pools').select('id, invite_code').in('id', poolIds),
    supabase
      .from('pool_members')
      .select('pool_id')
      .eq('user_id', userId)
      .in('pool_id', poolIds),
  ])

  if (poolsResult.error) {
    console.error('enrichDiscoverPools invite codes:', poolsResult.error.message)
  }
  if (membershipsResult.error) {
    console.error(
      'enrichDiscoverPools memberships:',
      membershipsResult.error.message,
    )
  }

  const inviteById = new Map<string, string>()
  for (const row of poolsResult.data ?? []) {
    const id = row.id as string
    const code = typeof row.invite_code === 'string' ? row.invite_code.trim() : ''
    if (id && code) inviteById.set(id, code)
  }

  const memberIds = new Set(
    (membershipsResult.data ?? []).map((row) => row.pool_id as string),
  )

  return pools.map((pool) => ({
    ...pool,
    inviteCode: inviteById.get(pool.id) || pool.inviteCode,
    isMember: memberIds.has(pool.id) || pool.isMember,
  }))
}

function sportRank(sport: string): number {
  const key = sport.trim().toLowerCase()
  const idx = SPORT_ORDER.indexOf(key as (typeof SPORT_ORDER)[number])
  return idx >= 0 ? idx : SPORT_ORDER.length + 1
}

function orderBySport(
  bySportRaw: Record<string, unknown>,
): DiscoverSportBucket[] {
  const buckets: DiscoverSportBucket[] = []
  for (const [sport, list] of Object.entries(bySportRaw)) {
    const pools = parsePoolList(list)
    if (pools.length === 0) continue
    buckets.push({
      sport,
      sportLabel: sportDisplayLabel(sport),
      pools,
    })
  }

  buckets.sort((a, b) => {
    const ra = sportRank(a.sport)
    const rb = sportRank(b.sport)
    if (ra !== rb) return ra - rb
    const ca = a.pools.reduce((n, p) => n + p.memberCount, 0)
    const cb = b.pools.reduce((n, p) => n + p.memberCount, 0)
    if (ca !== cb) return cb - ca
    return a.sportLabel.localeCompare(b.sportLabel)
  })

  return buckets
}

export async function fetchDiscoverSections(
  supabase: SupabaseClient,
  userId: string,
  cap = DISCOVER_SECTION_CAP,
): Promise<{ sections: DiscoverSectionsPayload; error: string | null }> {
  const { data, error } = await supabase.rpc('get_discover_sections', {
    p_user_id: userId,
    p_cap: cap,
  })

  if (error) {
    console.error('get_discover_sections failed:', error.message)
    return {
      sections: { official: [], public: [], trending: [], bySport: [] },
      error: error.message,
    }
  }

  const root =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {}

  const official = parsePoolList(root.official)
  const publicPools = parsePoolList(root.public)
  const trending = parsePoolList(root.trending)
  const bySportRaw =
    root.by_sport && typeof root.by_sport === 'object'
      ? (root.by_sport as Record<string, unknown>)
      : {}
  const bySport = orderBySport(bySportRaw)

  const allPools = [
    ...official,
    ...publicPools,
    ...trending,
    ...bySport.flatMap((b) => b.pools),
  ]
  const enriched = await enrichDiscoverPools(supabase, userId, allPools)
  const byId = new Map(enriched.map((p) => [p.id, p]))

  const mapList = (list: DiscoverPoolCard[]) =>
    list.map((p) => byId.get(p.id) ?? p)

  return {
    sections: {
      official: mapList(official),
      public: mapList(publicPools),
      trending: mapList(trending),
      bySport: bySport.map((b) => ({
        ...b,
        pools: mapList(b.pools),
      })),
    },
    error: null,
  }
}

export async function fetchDiscoverSectionAll(
  supabase: SupabaseClient,
  userId: string,
  section: DiscoverSectionKey,
  options?: { limit?: number; offset?: number },
): Promise<{ pools: DiscoverPoolCard[]; error: string | null }> {
  const limit = options?.limit ?? DISCOVER_SECTION_PAGE_SIZE
  const offset = options?.offset ?? 0

  const { data, error } = await supabase.rpc('get_discover_section_all', {
    p_user_id: userId,
    p_section: section,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('get_discover_section_all failed:', error.message)
    return { pools: [], error: error.message }
  }

  const pools = await enrichDiscoverPools(
    supabase,
    userId,
    parsePoolList(data),
  )
  return { pools, error: null }
}

export function discoverSectionTitle(section: DiscoverSectionKey): string {
  if (section === 'official') return 'Official pools'
  if (section === 'public') return 'Public pools'
  if (section === 'trending') return 'Trending pools'
  if (section.startsWith('sport:')) {
    const sport = section.slice('sport:'.length)
    return sport ? sportDisplayLabel(sport) : 'Pools by sport'
  }
  return 'Pools'
}

export function markPoolJoinedInList(
  list: DiscoverPoolCard[],
  poolId: string,
  alreadyMember: boolean,
): DiscoverPoolCard[] {
  return list.map((p) =>
    p.id === poolId
      ? {
          ...p,
          isMember: true,
          memberCount: alreadyMember ? p.memberCount : p.memberCount + 1,
        }
      : p,
  )
}

/**
 * Load official + public pools for Discover search (no dedicated search RPC).
 * Dedupes by id (official wins on conflict).
 */
export async function fetchDiscoverSearchCorpus(
  supabase: SupabaseClient,
  userId: string,
  limit = DISCOVER_SEARCH_FETCH_LIMIT,
): Promise<{ pools: DiscoverPoolCard[]; error: string | null }> {
  const [official, publicPools] = await Promise.all([
    fetchDiscoverSectionAll(supabase, userId, 'official', {
      limit,
      offset: 0,
    }),
    fetchDiscoverSectionAll(supabase, userId, 'public', {
      limit,
      offset: 0,
    }),
  ])

  const byId = new Map<string, DiscoverPoolCard>()
  for (const pool of official.pools) byId.set(pool.id, pool)
  for (const pool of publicPools.pools) {
    if (!byId.has(pool.id)) byId.set(pool.id, pool)
  }

  const error = official.error || publicPools.error
  return { pools: [...byId.values()], error }
}

/** Match pool name or event name (case-insensitive substring). */
export function filterDiscoverPoolsByQuery(
  pools: DiscoverPoolCard[],
  query: string,
): DiscoverPoolCard[] {
  const q = query.trim().toLowerCase()
  if (!q) return pools
  return pools.filter((pool) => {
    const hay = `${pool.name} ${pool.eventName}`.toLowerCase()
    return hay.includes(q)
  })
}

/** Official pools first, then name — for sport-filtered flat lists. */
export function sortDiscoverPoolsOfficialFirst(
  pools: DiscoverPoolCard[],
): DiscoverPoolCard[] {
  return [...pools].sort((a, b) => {
    if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function discoverSportSectionKey(
  sport: DiscoverSportId,
): DiscoverSectionKey {
  return `sport:${sport}`
}
