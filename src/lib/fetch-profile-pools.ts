import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSportKey } from '@/src/lib/sport-display'

export type ProfilePoolSummary = {
  id: string
  name: string
  /** Present when the viewer may open the pool (self, or public pool). */
  inviteCode: string | null
  eventName: string
  eventId: string | null
  /** Raw sport from sporting_events.sport (fallback soccer). */
  sport: string
  scoringStyle: string
  memberCount: number
  /** Profile owner's rank in this pool when readable. */
  standingRank: number | null
  isPublic: boolean
}

export type ProfileSportSummary = {
  key: string
  sport: string
  poolCount: number
}

type MembershipRow = {
  id: string
  pool_id: string
  pools: {
    id: string
    name: string
    invite_code: string
    event_name: string | null
    event_id: string | null
    scoring_style: string
    is_public: boolean | null
  } | null
}

const DEFAULT_EVENT_NAME = 'FIFA World Cup 2026'
const DEFAULT_SPORT = 'soccer'

/**
 * Slim pool list for ProfileShowcase (self + public).
 * Omits invite_code from the returned payload unless `includeInviteCodes`
 * (self) or the pool is `is_public`.
 */
export async function fetchProfilePools(
  supabase: SupabaseClient,
  profileUserId: string,
  options?: { includeInviteCodes?: boolean },
): Promise<{
  pools: ProfilePoolSummary[]
  sports: ProfileSportSummary[]
  error: string | null
}> {
  const includeInviteCodes = options?.includeInviteCodes === true

  if (!profileUserId) {
    return { pools: [], sports: [], error: null }
  }

  const { data: memberships, error: memberError } = await supabase
    .from('pool_members')
    .select(
      `
      id,
      pool_id,
      pools (
        id,
        name,
        invite_code,
        event_name,
        event_id,
        scoring_style,
        is_public
      )
    `,
    )
    .eq('user_id', profileUserId)

  if (memberError) {
    console.error('fetchProfilePools memberships:', memberError.message)
    return { pools: [], sports: [], error: memberError.message }
  }

  const memberRows = (memberships ?? []) as unknown as MembershipRow[]
  const valid = memberRows.filter((row) => row.pools != null)
  if (valid.length === 0) {
    return { pools: [], sports: [], error: null }
  }

  const poolIds = valid.map((row) => row.pool_id)
  const memberIds = valid.map((row) => row.id)
  const eventIds = [
    ...new Set(
      valid
        .map((row) => row.pools!.event_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const memberCountByPool = new Map<string, number>()
  const sportByEventId = new Map<string, string>()
  const rankByMemberId = new Map<string, number>()

  const [countsResult, eventsResult, ranksResult] = await Promise.all([
    supabase
      .from('pool_members')
      .select('pool_id')
      .in('pool_id', poolIds),
    eventIds.length > 0
      ? supabase
          .from('sporting_events')
          .select('id, sport')
          .in('id', eventIds)
      : Promise.resolve({ data: [] as { id: string; sport: string | null }[], error: null }),
    supabase
      .from('leaderboard_cache')
      .select('member_id, rank')
      .in('member_id', memberIds),
  ])

  if (countsResult.error) {
    console.error('fetchProfilePools counts:', countsResult.error.message)
  } else {
    for (const row of countsResult.data ?? []) {
      const poolId = (row as { pool_id: string }).pool_id
      memberCountByPool.set(poolId, (memberCountByPool.get(poolId) ?? 0) + 1)
    }
  }

  if (eventsResult.error) {
    console.error('fetchProfilePools events:', eventsResult.error.message)
  } else {
    for (const row of eventsResult.data ?? []) {
      const event = row as { id: string; sport: string | null }
      sportByEventId.set(
        event.id,
        (event.sport ?? '').trim() || DEFAULT_SPORT,
      )
    }
  }

  if (ranksResult.error) {
    // Public viewers may not read other members' ranks — omit quietly.
    console.error('fetchProfilePools ranks:', ranksResult.error.message)
  } else {
    for (const row of ranksResult.data ?? []) {
      const cache = row as { member_id: string; rank: number | null }
      if (cache.rank != null && cache.rank > 0) {
        rankByMemberId.set(cache.member_id, cache.rank)
      }
    }
  }

  const pools: ProfilePoolSummary[] = valid.map((row) => {
    const pool = row.pools!
    const eventId = pool.event_id
    const sport =
      (eventId ? sportByEventId.get(eventId) : null) ?? DEFAULT_SPORT
    const isPublic = Boolean(pool.is_public)
    const canExposeInvite = includeInviteCodes || isPublic

    return {
      id: pool.id,
      name: pool.name?.trim() || 'Pool',
      inviteCode: canExposeInvite ? pool.invite_code : null,
      eventName: pool.event_name?.trim() || DEFAULT_EVENT_NAME,
      eventId,
      sport,
      scoringStyle: pool.scoring_style,
      memberCount: memberCountByPool.get(row.pool_id) ?? 1,
      standingRank: rankByMemberId.get(row.id) ?? null,
      isPublic,
    }
  })

  pools.sort((a, b) => a.name.localeCompare(b.name))

  const sportCounts = new Map<string, { sport: string; count: number }>()
  for (const pool of pools) {
    const key = normalizeSportKey(pool.sport)
    const current = sportCounts.get(key)
    if (current) {
      current.count += 1
    } else {
      sportCounts.set(key, { sport: pool.sport, count: 1 })
    }
  }

  const sports: ProfileSportSummary[] = [...sportCounts.entries()]
    .map(([key, value]) => ({
      key,
      sport: value.sport,
      poolCount: value.count,
    }))
    .sort((a, b) => b.poolCount - a.poolCount || a.key.localeCompare(b.key))

  return { pools, sports, error: null }
}
