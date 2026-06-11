import type { SupabaseClient } from '@supabase/supabase-js'

export type MemberScoringContext = {
  memberId: string
  scoringStyle: string
}

export type MemberPredictionCounts = {
  /** Classic/exact: distinct match_id; winner: group_predictions row count. */
  predictionsByMember: Map<string, number>
  /** Classic/exact only: distinct match_id from predictions (win-rate denominator). */
  classicMatchPredictionsByMember: Map<string, number>
}

export async function fetchMemberPredictionCounts(
  supabase: SupabaseClient,
  memberships: MemberScoringContext[],
): Promise<MemberPredictionCounts> {
  const predictionsByMember = new Map<string, number>()
  const classicMatchPredictionsByMember = new Map<string, number>()

  if (memberships.length === 0) {
    return { predictionsByMember, classicMatchPredictionsByMember }
  }

  const classicMemberIds = memberships
    .filter((row) => row.scoringStyle !== 'winner')
    .map((row) => row.memberId)
  const winnerMemberIds = memberships
    .filter((row) => row.scoringStyle === 'winner')
    .map((row) => row.memberId)

  if (classicMemberIds.length > 0) {
    const { data: predictions } = await supabase
      .from('predictions')
      .select('member_id, match_id')
      .in('member_id', classicMemberIds)

    const distinctByMember = new Map<string, Set<string>>()
    for (const row of predictions ?? []) {
      if (!distinctByMember.has(row.member_id)) {
        distinctByMember.set(row.member_id, new Set())
      }
      distinctByMember.get(row.member_id)!.add(row.match_id)
    }
    for (const [memberId, matchIds] of distinctByMember) {
      const count = matchIds.size
      predictionsByMember.set(memberId, count)
      classicMatchPredictionsByMember.set(memberId, count)
    }
  }

  if (winnerMemberIds.length > 0) {
    const { data: groupPredictions } = await supabase
      .from('group_predictions')
      .select('member_id')
      .in('member_id', winnerMemberIds)

    for (const row of groupPredictions ?? []) {
      predictionsByMember.set(
        row.member_id,
        (predictionsByMember.get(row.member_id) ?? 0) + 1,
      )
    }
  }

  return { predictionsByMember, classicMatchPredictionsByMember }
}

export function sumMemberCounts(
  memberIds: string[],
  counts: Map<string, number>,
): number {
  return memberIds.reduce((sum, memberId) => sum + (counts.get(memberId) ?? 0), 0)
}
