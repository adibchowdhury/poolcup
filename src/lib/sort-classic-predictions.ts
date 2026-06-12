import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { WORLD_CUP_GROUP_LETTERS } from '@/src/lib/world-cup-groups'

export type ClassicPredictionSortMode = 'kickoff' | 'group' | 'status'

const KNOCKOUT_ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'final'] as const

function kickoffMs(kickoffAt: string): number {
  const ms = new Date(kickoffAt).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

function compareKickoffThenMatchId(
  a: UserPoolPrediction,
  b: UserPoolPrediction,
): number {
  const byKickoff = kickoffMs(a.kickoffAt) - kickoffMs(b.kickoffAt)
  if (byKickoff !== 0) return byKickoff
  return a.matchId.localeCompare(b.matchId)
}

function groupStageSortIndex(groupName: string | null): number {
  if (!groupName) return 999
  const idx = WORLD_CUP_GROUP_LETTERS.indexOf(
    groupName.trim().toUpperCase() as (typeof WORLD_CUP_GROUP_LETTERS)[number],
  )
  return idx >= 0 ? idx : 999
}

function knockoutRoundSortIndex(round: string): number {
  const idx = KNOCKOUT_ROUND_ORDER.indexOf(
    round as (typeof KNOCKOUT_ROUND_ORDER)[number],
  )
  return idx >= 0 ? idx : 99
}

function compareByGroupThenKickoff(
  a: UserPoolPrediction,
  b: UserPoolPrediction,
): number {
  const aIsGroup = a.round === 'group'
  const bIsGroup = b.round === 'group'

  if (aIsGroup !== bIsGroup) {
    return aIsGroup ? -1 : 1
  }

  if (aIsGroup) {
    const byGroup =
      groupStageSortIndex(a.groupName) - groupStageSortIndex(b.groupName)
    if (byGroup !== 0) return byGroup
  } else {
    const byRound = knockoutRoundSortIndex(a.round) - knockoutRoundSortIndex(b.round)
    if (byRound !== 0) return byRound
  }

  return compareKickoffThenMatchId(a, b)
}

function compareByStatusThenKickoff(
  a: UserPoolPrediction,
  b: UserPoolPrediction,
): number {
  const aFinished = a.isFinal ? 1 : 0
  const bFinished = b.isFinal ? 1 : 0
  if (aFinished !== bFinished) return aFinished - bFinished
  return compareKickoffThenMatchId(a, b)
}

export function sortClassicPredictions(
  predictions: UserPoolPrediction[],
  mode: ClassicPredictionSortMode,
): UserPoolPrediction[] {
  const sorted = [...predictions]

  switch (mode) {
    case 'group':
      sorted.sort(compareByGroupThenKickoff)
      break
    case 'status':
      sorted.sort(compareByStatusThenKickoff)
      break
    case 'kickoff':
    default:
      sorted.sort(compareKickoffThenMatchId)
      break
  }

  return sorted
}
