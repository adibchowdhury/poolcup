import type { SupabaseClient } from '@supabase/supabase-js'
import { isMatchLocked } from '@/src/lib/match-lock'
import { isVoidMatchStatus } from '@/src/lib/match-void-status'
import { getMakeYourPicksHorizonEndIso } from '@/src/lib/upcoming-match-horizon'
import {
  fetchUserClassicPoolEvents,
  normalizeEventId,
  type ClassicPoolMembership,
} from '@/src/lib/user-pool-events'

export type MakeYourPicksMatch = {
  id: string
  event_id: string
  event_name: string
  kickoff_at: string
  locked_at: string | null
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  team1_logo?: string | null
  team2_logo?: string | null
  group_name: string | null
  round: string
  status_short: string | null
  result_team1: number | null
  result_team2: number | null
  elapsed_minute: number | null
  is_final: boolean
  /** Pool display names still missing a prediction for this match. */
  pools_needing_names: string[]
  /** sporting_events.sport — small icon in queue rows. */
  sport: string | null
}

export type MakeYourPicksQueueResult = {
  matches: MakeYourPicksMatch[]
  hasPools: boolean
  hasClassicPools: boolean
  error: string | null
}

type MatchRow = {
  id: string
  event_id: string | null
  kickoff_at: string
  locked_at: string | null
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  team1_logo?: string | null
  team2_logo?: string | null
  group_name: string | null
  round: string
  status_short: string | null
  is_final: boolean
  result_team1: number | null
  result_team2: number | null
  elapsed_minute: number | null
}

const MATCH_COLUMNS =
  'id, event_id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, team1_logo, team2_logo, group_name, round, status_short, is_final, result_team1, result_team2, elapsed_minute'

/**
 * Pools on this match: member of, same event as match, no prediction yet.
 * Each membership is checked individually — never inferred from an event bucket alone.
 */
function poolsNeedingPickForMatch(
  match: MatchRow,
  memberships: ClassicPoolMembership[],
  predictedByMatch: Map<string, Set<string>>,
): string[] {
  const matchEventId = normalizeEventId(match.event_id)
  if (!matchEventId) return []

  const names: string[] = []
  for (const membership of memberships) {
    if (normalizeEventId(membership.eventId) !== matchEventId) continue
    if (predictedByMatch.get(match.id)?.has(membership.memberId)) continue
    names.push(membership.poolName)
  }

  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}

/**
 * Cross-pool prediction queue for the dashboard home tab.
 * Composes existing tables (no new RPC): pool_members → matches → predictions diff.
 *
 * Pool scoping: only current `pool_members` rows; matches limited to those event ids;
 * pool labels are derived per match by filtering memberships where pool.event_id === match.event_id.
 */
export async function fetchMakeYourPicksQueue(
  supabase: SupabaseClient,
  userId: string,
): Promise<MakeYourPicksQueueResult> {
  const {
    memberships: classicMemberships,
    memberEventIdSet,
    hasPools,
    hasClassicPools,
    error: memberError,
  } = await fetchUserClassicPoolEvents(supabase, userId)

  if (memberError) {
    return {
      matches: [],
      hasPools: false,
      hasClassicPools: false,
      error: memberError,
    }
  }

  if (!hasClassicPools) {
    return { matches: [], hasPools, hasClassicPools: false, error: null }
  }

  const eventIdsForQuery = [...new Set(classicMemberships.map((row) => row.eventId))]
  if (eventIdsForQuery.length === 0) {
    return { matches: [], hasPools, hasClassicPools, error: null }
  }

  const { data: sportingEvents } = await supabase
    .from('sporting_events')
    .select('id, name, sport')
    .in('id', eventIdsForQuery)

  const eventNameById = new Map<string, string>()
  const sportByEventId = new Map<string, string>()
  for (const event of sportingEvents ?? []) {
    const id = normalizeEventId(event.id)
    const name = typeof event.name === 'string' ? event.name.trim() : ''
    if (id && name) eventNameById.set(id, name)
    const sport =
      typeof event.sport === 'string' ? event.sport.trim() : ''
    if (id && sport) sportByEventId.set(id, sport)
  }

  const nowIso = new Date().toISOString()
  const horizonEndIso = getMakeYourPicksHorizonEndIso()

  const { data: matchRows, error: matchError } = await supabase
    .from('matches')
    .select(MATCH_COLUMNS)
    .in('event_id', eventIdsForQuery)
    .eq('is_final', false)
    .gt('kickoff_at', nowIso)
    .lte('kickoff_at', horizonEndIso)
    .order('kickoff_at', { ascending: true })

  if (matchError) {
    return {
      matches: [],
      hasPools,
      hasClassicPools,
      error: matchError.message,
    }
  }

  const openMatches = ((matchRows ?? []) as MatchRow[]).filter((match) => {
    const matchEventId = normalizeEventId(match.event_id)
    return (
      matchEventId != null &&
      memberEventIdSet.has(matchEventId) &&
      !isMatchLocked(match.locked_at) &&
      !isVoidMatchStatus(match.status_short)
    )
  })

  if (openMatches.length === 0) {
    return { matches: [], hasPools, hasClassicPools, error: null }
  }

  const memberIds = classicMemberships.map((row) => row.memberId)
  const matchIds = openMatches.map((match) => match.id)

  const { data: predictionRows, error: predError } = await supabase
    .from('predictions')
    .select('member_id, match_id')
    .in('member_id', memberIds)
    .in('match_id', matchIds)

  if (predError) {
    return {
      matches: [],
      hasPools,
      hasClassicPools,
      error: predError.message,
    }
  }

  const predictedByMatch = new Map<string, Set<string>>()
  for (const row of predictionRows ?? []) {
    const set = predictedByMatch.get(row.match_id) ?? new Set<string>()
    set.add(row.member_id)
    predictedByMatch.set(row.match_id, set)
  }

  const queue: MakeYourPicksMatch[] = []

  for (const match of openMatches) {
    const matchEventId = normalizeEventId(match.event_id)
    if (!matchEventId || !memberEventIdSet.has(matchEventId)) continue

    const poolsNeedingNames = poolsNeedingPickForMatch(
      match,
      classicMemberships,
      predictedByMatch,
    )
    // Defensive: no cross-event leak — skip if no same-event pools need this match.
    if (poolsNeedingNames.length === 0) continue

    queue.push({
      id: match.id,
      event_id: match.event_id!,
      event_name: eventNameById.get(matchEventId) ?? '',
      kickoff_at: match.kickoff_at,
      locked_at: match.locked_at,
      team1_name: match.team1_name,
      team2_name: match.team2_name,
      team1_flag: match.team1_flag,
      team2_flag: match.team2_flag,
      team1_logo: match.team1_logo,
      team2_logo: match.team2_logo,
      group_name: match.group_name,
      round: match.round,
      status_short: match.status_short,
      result_team1: match.result_team1,
      result_team2: match.result_team2,
      elapsed_minute: match.elapsed_minute,
      is_final: match.is_final,
      pools_needing_names: poolsNeedingNames,
      sport: sportByEventId.get(matchEventId) ?? null,
    })
  }

  queue.sort((a, b) => {
    const aUrgency = new Date(a.locked_at ?? a.kickoff_at).getTime()
    const bUrgency = new Date(b.locked_at ?? b.kickoff_at).getTime()
    if (aUrgency !== bUrgency) return aUrgency - bUrgency
    return new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  })

  return { matches: queue, hasPools, hasClassicPools, error: null }
}
