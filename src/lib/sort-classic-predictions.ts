import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { WORLD_CUP_GROUP_LETTERS } from '@/src/lib/world-cup-groups'

const KNOCKOUT_ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'final'] as const

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

/** Display order: group stage A→L, then knockout rounds; kickoff ascending within each. */
export function sortClassicPredictionsForDisplay(
  predictions: UserPoolPrediction[],
): UserPoolPrediction[] {
  return [...predictions].sort((a, b) => {
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

    return (
      new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()
    )
  })
}
