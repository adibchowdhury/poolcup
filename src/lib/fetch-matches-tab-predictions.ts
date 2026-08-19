import type { SupabaseClient } from '@supabase/supabase-js'
import { isMatchLocked } from '@/src/lib/match-lock'
import type { MatchesTabMatch } from '@/src/lib/fetch-matches-tab'
import {
  getMemberEventIdSet,
  matchEventIsInUserPools,
  normalizeEventId,
  type ClassicPoolMembership,
} from '@/src/lib/user-pool-events'

export type MatchesTabPredictionStatus =
  | 'not_picked'
  | 'picked'
  | 'locked_unpicked'
  | 'locked_picked'

export type MatchesTabPredictionSummary = {
  status: MatchesTabPredictionStatus
  /** Scoreline for picked states, e.g. "2–1". */
  pickLabel?: string
}

type PredictionRow = {
  match_id: string
  member_id: string
  pred_team1: number | null
  pred_team2: number | null
  submitted_at: string | null
}

/**
 * Per-match prediction state for the Matches tab (classic pools only).
 * Returns entries only for upcoming matches in events the user pools follow.
 */
export async function fetchMatchesTabPredictionSummaries(
  supabase: SupabaseClient,
  matches: MatchesTabMatch[],
  memberships: ClassicPoolMembership[],
  nowMs: number = Date.now(),
): Promise<Map<string, MatchesTabPredictionSummary>> {
  const result = new Map<string, MatchesTabPredictionSummary>()
  if (memberships.length === 0) return result

  const memberIds = memberships.map((row) => row.memberId)
  const memberEventIdSet = getMemberEventIdSet(memberships)
  const memberIdsByEvent = new Map<string, Set<string>>()
  for (const membership of memberships) {
    const eventId = normalizeEventId(membership.eventId)
    if (!eventId) continue
    const set = memberIdsByEvent.get(eventId) ?? new Set<string>()
    set.add(membership.memberId)
    memberIdsByEvent.set(eventId, set)
  }

  const scopedMatches = matches.filter(
    (match) =>
      !match.is_final &&
      matchEventIsInUserPools(match.event_id, memberEventIdSet) &&
      new Date(match.kickoff_at).getTime() > nowMs,
  )

  if (scopedMatches.length === 0) return result

  const matchIds = scopedMatches.map((match) => match.id)
  const { data, error } = await supabase
    .from('predictions')
    .select('match_id, member_id, pred_team1, pred_team2, submitted_at')
    .in('member_id', memberIds)
    .in('match_id', matchIds)

  if (error) {
    console.error('fetchMatchesTabPredictionSummaries failed:', error.message)
    return result
  }

  const picksByMatch = new Map<string, PredictionRow[]>()
  for (const row of (data ?? []) as PredictionRow[]) {
    const list = picksByMatch.get(row.match_id) ?? []
    list.push(row)
    picksByMatch.set(row.match_id, list)
  }

  for (const match of scopedMatches) {
    const locked = isMatchLocked(match.locked_at ?? null)
    const eventId = normalizeEventId(match.event_id)
    const eventMemberIds = eventId ? memberIdsByEvent.get(eventId) : undefined
    const rows = (picksByMatch.get(match.id) ?? []).filter((row) =>
      eventMemberIds?.has(row.member_id),
    )

    const scoredPick = rows
      .filter(
        (row) =>
          typeof row.pred_team1 === 'number' && typeof row.pred_team2 === 'number',
      )
      .sort(
        (a, b) =>
          new Date(b.submitted_at ?? 0).getTime() -
          new Date(a.submitted_at ?? 0).getTime(),
      )[0]

    if (scoredPick) {
      result.set(match.id, {
        status: locked ? 'locked_picked' : 'picked',
        pickLabel: `${scoredPick.pred_team1}–${scoredPick.pred_team2}`,
      })
    } else if (locked) {
      result.set(match.id, { status: 'locked_unpicked' })
    } else {
      result.set(match.id, { status: 'not_picked' })
    }
  }

  return result
}
