import type { LeaderboardPointBreakdownItem } from '@/components/pool/leaderboard-row'

export const WINNER_KNOCKOUT_ADVANCE_REASON = 'Correct advance'
export const WINNER_THIRD_PLACE_BREAKDOWN_LABEL = 'Best third-place teams'

const KNOCKOUT_ROUND_ORDER: Record<string, number> = {
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  final: 5,
}

type GroupPredictionBreakdownRow = {
  member_id: string
  group_name: string
  points_awarded: number | null
}

type ThirdPlaceBreakdownRow = {
  user_id: string
  points_awarded: number | null
}

type KnockoutMatchBreakdown = {
  team1_name: string
  team2_name: string
  result_team1: number
  result_team2: number
  round: string
  group_name: string | null
  kickoff_at: string
}

type KnockoutPredictionBreakdownRow = {
  member_id: string
  match_id: string
  pred_team1: number
  pred_team2: number
  points_awarded: number | null
  matches: KnockoutMatchBreakdown | KnockoutMatchBreakdown[] | null
}

export type BuildWinnerLeaderboardBreakdownParams = {
  groupRows: GroupPredictionBreakdownRow[]
  thirdPlaceRows: ThirdPlaceBreakdownRow[]
  knockoutRows: KnockoutPredictionBreakdownRow[]
  userIdToMemberId: Map<string, string>
}

function scoredPoints(value: number | null | undefined): value is number {
  return value != null && value > 0
}

function groupBreakdownItem(
  memberId: string,
  groupName: string,
  pointsAwarded: number,
): LeaderboardPointBreakdownItem {
  const letter = groupName.toUpperCase()
  return {
    matchId: `winner-group-${memberId}-${letter}`,
    displayLabel: `Group ${letter} ranking`,
    reasonLabel: '',
    predTeam1: 0,
    predTeam2: 0,
    pointsAwarded,
    team1Name: '',
    team2Name: '',
    resultTeam1: 0,
    resultTeam2: 0,
    round: 'group_ranking',
    groupName: letter,
    kickoffAt: '',
  }
}

function thirdPlaceBreakdownItem(
  memberId: string,
  pointsAwarded: number,
): LeaderboardPointBreakdownItem {
  return {
    matchId: `winner-third-place-${memberId}`,
    displayLabel: WINNER_THIRD_PLACE_BREAKDOWN_LABEL,
    reasonLabel: '',
    predTeam1: 0,
    predTeam2: 0,
    pointsAwarded,
    team1Name: '',
    team2Name: '',
    resultTeam1: 0,
    resultTeam2: 0,
    round: 'third_place',
    groupName: null,
    kickoffAt: '',
  }
}

function knockoutBreakdownItem(
  row: KnockoutPredictionBreakdownRow,
  match: KnockoutMatchBreakdown,
): LeaderboardPointBreakdownItem {
  return {
    matchId: row.match_id,
    predTeam1: row.pred_team1,
    predTeam2: row.pred_team2,
    pointsAwarded: row.points_awarded!,
    reasonLabel: WINNER_KNOCKOUT_ADVANCE_REASON,
    team1Name: match.team1_name,
    team2Name: match.team2_name,
    resultTeam1: match.result_team1,
    resultTeam2: match.result_team2,
    round: match.round,
    groupName: match.group_name,
    kickoffAt: match.kickoff_at,
  }
}

function sortKnockoutItems(
  items: LeaderboardPointBreakdownItem[],
): LeaderboardPointBreakdownItem[] {
  return [...items].sort((a, b) => {
    const roundDelta =
      (KNOCKOUT_ROUND_ORDER[a.round] ?? 99) -
      (KNOCKOUT_ROUND_ORDER[b.round] ?? 99)
    if (roundDelta !== 0) return roundDelta
    return new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()
  })
}

export function buildWinnerLeaderboardBreakdownByMember({
  groupRows,
  thirdPlaceRows,
  knockoutRows,
  userIdToMemberId,
}: BuildWinnerLeaderboardBreakdownParams): Map<
  string,
  LeaderboardPointBreakdownItem[]
> {
  const breakdownByMember = new Map<string, LeaderboardPointBreakdownItem[]>()

  const groupByMember = new Map<string, GroupPredictionBreakdownRow[]>()
  for (const row of groupRows) {
    if (!scoredPoints(row.points_awarded)) continue
    const list = groupByMember.get(row.member_id) ?? []
    list.push(row)
    groupByMember.set(row.member_id, list)
  }

  for (const [memberId, rows] of groupByMember) {
    const sorted = [...rows].sort((a, b) =>
      a.group_name.localeCompare(b.group_name),
    )
    const items = sorted.map((row) =>
      groupBreakdownItem(memberId, row.group_name, row.points_awarded!),
    )
    breakdownByMember.set(memberId, items)
  }

  for (const row of thirdPlaceRows) {
    if (!scoredPoints(row.points_awarded)) continue
    const memberId = userIdToMemberId.get(row.user_id)
    if (!memberId) continue

    const list = breakdownByMember.get(memberId) ?? []
    list.push(thirdPlaceBreakdownItem(memberId, row.points_awarded))
    breakdownByMember.set(memberId, list)
  }

  const knockoutByMember = new Map<string, LeaderboardPointBreakdownItem[]>()
  for (const row of knockoutRows) {
    if (!scoredPoints(row.points_awarded)) continue

    const matchRaw = row.matches
    const match = Array.isArray(matchRaw) ? matchRaw[0] : matchRaw
    if (!match) continue
    if (match.result_team1 == null || match.result_team2 == null) continue

    const item = knockoutBreakdownItem(row, match)
    const list = knockoutByMember.get(row.member_id) ?? []
    list.push(item)
    knockoutByMember.set(row.member_id, list)
  }

  for (const [memberId, knockoutItems] of knockoutByMember) {
    const list = breakdownByMember.get(memberId) ?? []
    list.push(...sortKnockoutItems(knockoutItems))
    breakdownByMember.set(memberId, list)
  }

  return breakdownByMember
}

export type SerializedWinnerLeaderboardBreakdown = Record<
  string,
  LeaderboardPointBreakdownItem[]
>

export function serializeWinnerLeaderboardBreakdown(
  breakdownByMember: Map<string, LeaderboardPointBreakdownItem[]>,
): SerializedWinnerLeaderboardBreakdown {
  return Object.fromEntries(breakdownByMember)
}

export function deserializeWinnerLeaderboardBreakdown(
  serialized: SerializedWinnerLeaderboardBreakdown,
): Map<string, LeaderboardPointBreakdownItem[]> {
  return new Map(Object.entries(serialized))
}
