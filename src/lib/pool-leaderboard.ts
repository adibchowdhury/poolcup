import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import { buildLeaderboardPlaceGroups } from '@/components/pool/leaderboard-grouped-list'

export type PoolLeaderboardMember = {
  id: string
  user_id: string
  display_name: string
  joined_at: string
}

export type LeaderboardCacheRow = {
  rank: number
  prev_rank: number | null
  member_id: string
  total_points: number | null
  correct_winners?: number | null
}

type BuildPoolLeaderboardParams = {
  poolMembers: PoolLeaderboardMember[]
  creatorUserId: string
  cacheRows: LeaderboardCacheRow[] | null
  matchesPlayedCount: number
  currentUserId: string
  predictionsByMember: Map<string, number>
  isWinnerPool: boolean
  avatarsByMemberId: Map<string, string | null>
}

function sortPoolMembersForPreMatch(
  members: PoolLeaderboardMember[],
  creatorUserId: string,
): PoolLeaderboardMember[] {
  const creator = members.find((m) => m.user_id === creatorUserId)
  const rest = members
    .filter((m) => m.user_id !== creatorUserId)
    .sort(
      (a, b) =>
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
    )

  return creator ? [creator, ...rest] : rest
}

function getMovement(
  rank: number,
  prevRank: number | null,
): 'up' | 'down' | 'none' {
  if (prevRank == null || prevRank <= 0) return 'none'
  const delta = prevRank - rank
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'none'
}

function hasLeaderboardCacheData(
  cacheRows: LeaderboardCacheRow[] | null,
): boolean {
  return (cacheRows?.length ?? 0) > 0
}

export function buildPoolLeaderboardMembers({
  poolMembers,
  creatorUserId,
  cacheRows,
  matchesPlayedCount,
  currentUserId,
  predictionsByMember,
  isWinnerPool,
  avatarsByMemberId,
}: BuildPoolLeaderboardParams): LeaderboardMember[] {
  const cacheByMember = new Map(
    (cacheRows ?? []).map((row) => [row.member_id, row]),
  )
  const useCache =
    hasLeaderboardCacheData(cacheRows) &&
    (isWinnerPool || matchesPlayedCount > 0)

  let entries: Array<{
    member_id: string
    user_id: string
    display_name: string
    points: number
    correct_predictions: number
    rank: number
    prev_rank: number | null
  }>

  if (!useCache && matchesPlayedCount === 0) {
    const ordered = sortPoolMembersForPreMatch(poolMembers, creatorUserId)
    entries = ordered.map((member, index) => ({
      rank: index + 1,
      prev_rank: null,
      member_id: member.id,
      user_id: member.user_id,
      display_name: member.display_name,
      points: 0,
      correct_predictions: 0,
    }))
  } else if (useCache) {
    entries = poolMembers.map((member) => {
      const row = cacheByMember.get(member.id)
      return {
        rank: row?.rank ?? poolMembers.length,
        prev_rank:
          row?.prev_rank != null && row.prev_rank > 0 ? row.prev_rank : null,
        member_id: member.id,
        user_id: member.user_id,
        display_name: member.display_name,
        points: row?.total_points ?? 0,
        correct_predictions: isWinnerPool ? 0 : (row?.correct_winners ?? 0),
      }
    })
  } else {
    entries = poolMembers.map((member, index) => ({
      rank: index + 1,
      prev_rank: null,
      member_id: member.id,
      user_id: member.user_id,
      display_name: member.display_name,
      points: 0,
      correct_predictions: 0,
    }))
  }

  return entries.map((entry) => ({
    id: entry.member_id,
    name: entry.display_name,
    isYou: currentUserId === entry.user_id,
    avatar: avatarsByMemberId.get(entry.member_id) ?? null,
    points: entry.points,
    correctPredictions: entry.correct_predictions,
    totalPredictions: predictionsByMember.get(entry.member_id) ?? 0,
    movement: getMovement(entry.rank, entry.prev_rank),
    streak: 0,
  }))
}

export function getMemberConsecutivePlace(
  members: LeaderboardMember[],
  memberId: string,
): number | null {
  const groups = buildLeaderboardPlaceGroups(members)
  for (const group of groups) {
    if (group.members.some((member) => member.id === memberId)) {
      return group.place
    }
  }
  return null
}

export function poolHasLeaderboardResults(
  members: LeaderboardMember[],
  matchesPlayedCount: number,
  isWinnerPool: boolean,
): boolean {
  if (matchesPlayedCount > 0) return true
  if (isWinnerPool && members.some((member) => member.points > 0)) return true
  return false
}
