import type { SupabaseClient } from '@supabase/supabase-js'

type MembershipRow = {
  id: string
  pool_id: string
  pools: {
    id: string
    name: string
    event_id: string | null
    event_name: string | null
    scoring_style: string
  } | null
}

/** Per-membership pool context — eventId is always taken from that pool row. */
export type ClassicPoolMembership = {
  memberId: string
  poolId: string
  poolName: string
  eventId: string
}

export function normalizeEventId(id: string | null | undefined): string | null {
  if (id == null) return null
  const normalized = String(id).trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export function parseClassicMembership(
  row: MembershipRow,
): ClassicPoolMembership | null {
  const pool = row.pools
  if (!pool) return null

  const eventId = pool.event_id?.trim()
  if (!eventId) return null

  return {
    memberId: row.id,
    poolId: pool.id,
    poolName: pool.name?.trim() || 'Pool',
    eventId,
  }
}

export function getMemberEventIdSet(
  memberships: ClassicPoolMembership[],
): Set<string> {
  return new Set(
    memberships
      .map((row) => normalizeEventId(row.eventId))
      .filter((id): id is string => id != null),
  )
}

/** Whether a match event belongs to one of the user's classic pool events. */
export function matchEventIsInUserPools(
  eventId: string | null | undefined,
  memberEventIdSet: Set<string>,
): boolean {
  const normalized = normalizeEventId(eventId)
  return normalized != null && memberEventIdSet.has(normalized)
}

export type UserClassicPoolEventsResult = {
  memberships: ClassicPoolMembership[]
  memberEventIdSet: Set<string>
  hasPools: boolean
  hasClassicPools: boolean
  error: string | null
}

/**
 * Classic (non-winner) pool memberships for the user — same scoping as Make Your Picks.
 * Matches are included when match.event_id matches any membership pool's event_id.
 */
export async function fetchUserClassicPoolEvents(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserClassicPoolEventsResult> {
  const { data: memberships, error: memberError } = await supabase
    .from('pool_members')
    .select(
      `
      id,
      pool_id,
      pools (
        id,
        name,
        event_id,
        event_name,
        scoring_style
      )
    `,
    )
    .eq('user_id', userId)

  if (memberError) {
    return {
      memberships: [],
      memberEventIdSet: new Set(),
      hasPools: false,
      hasClassicPools: false,
      error: memberError.message,
    }
  }

  const rows = (memberships ?? []) as unknown as MembershipRow[]
  const valid = rows.filter((row) => row.pools != null)
  const hasPools = valid.length > 0

  const classicMemberships = valid
    .filter((row) => row.pools!.scoring_style !== 'winner')
    .map(parseClassicMembership)
    .filter((row): row is ClassicPoolMembership => row != null)

  return {
    memberships: classicMemberships,
    memberEventIdSet: getMemberEventIdSet(classicMemberships),
    hasPools,
    hasClassicPools: classicMemberships.length > 0,
    error: null,
  }
}
