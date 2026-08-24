import type { SupabaseClient } from '@supabase/supabase-js'
import { POOL_EVENT_NAME_FALLBACK } from '@/src/lib/pool-event-label'
import type { User } from '@supabase/supabase-js'

export type OfficialPoolListItem = {
  id: string
  name: string
  inviteCode: string
  eventId: string | null
  /** Clean league title for the card (no "Official", no season suffix). */
  leagueName: string
  /** e.g. "2026/27" from provider_season / dates. */
  seasonLabel: string | null
  eventStatus: string | null
  eventStartDate: string | null
  /** pools.scoring_style — classic/exact → Score Predictor, winner → Winner Only. */
  scoringStyle: string
  memberCount: number
  isMember: boolean
  /** sporting_events.sport — official sport-ball logo. */
  sport: string | null
  /** Preset squad photo under /pool_avatars. */
  avatar: string | null
  /** Custom uploaded emblem URL. */
  emblemUrl: string | null
  /** pools.theme_color — banner tint on discover cards. */
  themeColor: string | null
}

type PoolRow = {
  id: string
  name: string
  invite_code: string
  event_id: string | null
  event_name: string | null
  scoring_style: string
  avatar: string | null
  emblem_url: string | null
  theme_color: string | null
}

type EventRow = {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  provider_season: string | null
  sport: string | null
}

/** Strip "Official"/Pool/year so the card can show the league name as text only. */
export function formatOfficialLeagueName(
  eventName: string | null | undefined,
  poolName: string,
): string {
  let name = (eventName ?? poolName).trim()
  name = name.replace(/^Official\s+/i, '')
  name = name.replace(/\s+Pool$/i, '')
  name = name.replace(/\s+20\d{2}(\s*[/–-]\s*\d{2,4})?$/i, '')
  return name.trim() || 'Soccer'
}

export function formatOfficialSeasonLabel(
  providerSeason: string | null | undefined,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string | null {
  const season = providerSeason?.trim()
  if (season && /^\d{4}$/.test(season)) {
    const y = Number(season)
    return `${y}/${String(y + 1).slice(-2)}`
  }
  if (season && /^\d{4}\/\d{2}$/.test(season)) return season
  if (season && /^\d{4}-\d{4}$/.test(season)) {
    const [start, end] = season.split('-')
    return `${start}/${end.slice(-2)}`
  }

  if (startDate) {
    const startYear = new Date(startDate).getUTCFullYear()
    if (!Number.isNaN(startYear)) {
      if (endDate) {
        const endYear = new Date(endDate).getUTCFullYear()
        if (!Number.isNaN(endYear) && endYear !== startYear) {
          return `${startYear}/${String(endYear).slice(-2)}`
        }
      }
      return `${startYear}/${String(startYear + 1).slice(-2)}`
    }
  }
  return null
}

/**
 * Engaging status from sporting_events.status + start_date.
 * live → "Live Now"; upcoming → "Starts {Mon D}"; completed → "Ended".
 */
export function formatOfficialStatusLabel(
  status: string | null | undefined,
  startDate: string | null | undefined,
): { kind: 'live' | 'starts' | 'ended' | 'none'; label: string } {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'live') return { kind: 'live', label: 'Live Now' }
  if (s === 'upcoming' || s === 'scheduled') {
    if (startDate) {
      const d = new Date(startDate)
      if (!Number.isNaN(d.getTime())) {
        const monDay = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })
        return { kind: 'starts', label: `Starts ${monDay}` }
      }
    }
    return { kind: 'none', label: '' }
  }
  if (s === 'completed' || s === 'finished') {
    return { kind: 'ended', label: 'Ended' }
  }
  return { kind: 'none', label: '' }
}

export function formatPlayerCountLabel(count: number): string {
  return `${count} joined`
}

/**
 * Official public pools for the dashboard Discover surface.
 * Query: pools where is_official AND is_public, enriched with sporting_events
 * name/status/dates and whether the current user is already a member.
 */
export async function fetchOfficialPublicPools(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ pools: OfficialPoolListItem[]; error: string | null }> {
  const { data: poolRows, error: poolsError } = await supabase
    .from('pools')
    .select(
      'id, name, invite_code, event_id, event_name, scoring_style, avatar, emblem_url, theme_color',
    )
    .eq('is_official', true)
    .eq('is_public', true)
    .order('name', { ascending: true })

  if (poolsError) {
    console.error('fetchOfficialPublicPools:', poolsError.message)
    return { pools: [], error: poolsError.message }
  }

  const pools = (poolRows ?? []) as PoolRow[]
  if (pools.length === 0) {
    return { pools: [], error: null }
  }

  const poolIds = pools.map((p) => p.id)
  const eventIds = [
    ...new Set(
      pools
        .map((p) => p.event_id)
        .filter((id): id is string => Boolean(id?.trim())),
    ),
  ]

  const [eventsResult, membersResult, myMembershipsResult] = await Promise.all([
    eventIds.length > 0
      ? supabase
          .from('sporting_events')
          .select(
            'id, name, status, start_date, end_date, provider_season, sport',
          )
          .in('id', eventIds)
      : Promise.resolve({ data: [] as EventRow[], error: null }),
    supabase.from('pool_members').select('pool_id').in('pool_id', poolIds),
    supabase
      .from('pool_members')
      .select('pool_id')
      .eq('user_id', userId)
      .in('pool_id', poolIds),
  ])

  if (eventsResult.error) {
    console.error(
      'fetchOfficialPublicPools events:',
      eventsResult.error.message,
    )
  }
  if (membersResult.error) {
    console.error(
      'fetchOfficialPublicPools members:',
      membersResult.error.message,
    )
  }
  if (myMembershipsResult.error) {
    console.error(
      'fetchOfficialPublicPools my memberships:',
      myMembershipsResult.error.message,
    )
  }

  const eventsById = new Map<string, EventRow>()
  for (const row of (eventsResult.data ?? []) as EventRow[]) {
    eventsById.set(row.id, row)
  }

  const memberCounts = new Map<string, number>()
  for (const row of membersResult.data ?? []) {
    const id = row.pool_id as string
    memberCounts.set(id, (memberCounts.get(id) ?? 0) + 1)
  }

  const myPoolIds = new Set(
    (myMembershipsResult.data ?? []).map((row) => row.pool_id as string),
  )

  const items: OfficialPoolListItem[] = pools.map((pool) => {
    const event = pool.event_id ? eventsById.get(pool.event_id) : undefined
    const eventName = event?.name?.trim() || POOL_EVENT_NAME_FALLBACK
    return {
      id: pool.id,
      name: pool.name,
      inviteCode: pool.invite_code,
      eventId: pool.event_id,
      leagueName: formatOfficialLeagueName(eventName, pool.name),
      seasonLabel: formatOfficialSeasonLabel(
        event?.provider_season,
        event?.start_date,
        event?.end_date,
      ),
      eventStatus: event?.status ?? null,
      eventStartDate: event?.start_date ?? null,
      scoringStyle: pool.scoring_style || 'classic',
      memberCount: memberCounts.get(pool.id) ?? 0,
      isMember: myPoolIds.has(pool.id),
      sport: event?.sport ?? null,
      avatar: pool.avatar ?? null,
      emblemUrl: pool.emblem_url ?? null,
      themeColor: pool.theme_color ?? null,
    }
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
    return a.leagueName.localeCompare(b.leagueName)
  })

  return { pools: items, error: null }
}

/**
 * Resolve display_name the same way create/invite-join do:
 * users.display_name → email local-part → fallback.
 */
export async function resolveJoinDisplayName(
  supabase: SupabaseClient,
  user: Pick<User, 'id' | 'email'>,
  fallback = 'Player',
): Promise<string> {
  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const fromProfile = profile?.display_name?.trim()
  if (fromProfile) return fromProfile

  const fromEmail = user.email?.split('@')[0]?.trim()
  return fromEmail || fallback
}

/**
 * Join a public/official pool (no invite code). Same pool_members insert as
 * the invite join flow. RLS: auth.uid() = user_id (unchanged).
 */
export async function joinPublicPool(
  supabase: SupabaseClient,
  user: Pick<User, 'id' | 'email'>,
  poolId: string,
): Promise<{ error: string | null; alreadyMember: boolean }> {
  const displayName = await resolveJoinDisplayName(supabase, user)

  const { error } = await supabase.from('pool_members').insert({
    pool_id: poolId,
    user_id: user.id,
    display_name: displayName,
  })

  if (!error) {
    if (typeof window !== 'undefined') {
      void import('@/src/lib/xp-client').then(({ awardClientXp }) => {
        void awardClientXp({ sourceType: 'pool_join', sourceId: poolId })
      })
      void fetch('/api/notifications/notify-pool-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      }).catch(() => {})
      void fetch('/api/pool-join-attribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId, source: 'official_join' }),
      }).catch(() => {})
    }
    return { error: null, alreadyMember: false }
  }

  if (error.code === '23505') {
    return { error: null, alreadyMember: true }
  }

  return { error: error.message, alreadyMember: false }
}
