import type { LeaderboardPointBreakdownItem } from '@/components/pool/leaderboard-row'
import {
  isKnockoutRound,
  type KnockoutRoundId,
} from '@/src/lib/classic-round-tab-logic'
import {
  KNOCKOUT_ROUND_POINT_VALUES,
  resolveAdvancePickFromScores,
} from '@/src/lib/knockout-match-prediction'

export const CLASSIC_KNOCKOUT_EXACT_REASON = 'Exact score'
export const CLASSIC_KNOCKOUT_ADVANCE_REASON = 'Correct advance'

export type ClassicKnockoutDisplayOutcomeKind = 'exact' | 'advance' | 'wrong'

export type ClassicKnockoutDisplayOutcome = {
  points: number
  label: string
  kind: ClassicKnockoutDisplayOutcomeKind
}

export type ClassicKnockoutDisplayOutcomeInput = {
  round: string
  predTeam1: number
  predTeam2: number
  advancePick: number | null
  resultTeam1: number
  resultTeam2: number
  advancingTeam: number | null
}

/** Card / summary line for classic knockout earned points (matches leaderboard labels). */
export function getClassicKnockoutPredictionDisplayOutcome(
  input: ClassicKnockoutDisplayOutcomeInput,
): ClassicKnockoutDisplayOutcome {
  if (!isKnockoutRound(input.round)) {
    return { points: 0, label: 'Wrong', kind: 'wrong' }
  }

  const round = input.round as KnockoutRoundId
  const values = KNOCKOUT_ROUND_POINT_VALUES[round]

  const exactHit =
    input.predTeam1 === input.resultTeam1 &&
    input.predTeam2 === input.resultTeam2

  const effectiveAdvance = resolveAdvancePickFromScores(
    input.predTeam1,
    input.predTeam2,
    input.advancePick,
  )

  const advanceHit =
    effectiveAdvance != null &&
    input.advancingTeam != null &&
    effectiveAdvance === input.advancingTeam

  if (exactHit) {
    return {
      points: values.exact,
      label: CLASSIC_KNOCKOUT_EXACT_REASON,
      kind: 'exact',
    }
  }

  if (advanceHit) {
    return {
      points: values.advance,
      label: CLASSIC_KNOCKOUT_ADVANCE_REASON,
      kind: 'advance',
    }
  }

  return { points: 0, label: 'Wrong', kind: 'wrong' }
}

export type ClassicKnockoutBreakdownInput = {
  matchId: string
  predTeam1: number
  predTeam2: number
  advancePick: number | null
  pointsAwarded: number
  team1Name: string
  team2Name: string
  resultTeam1: number
  resultTeam2: number
  round: string
  groupName: string | null
  kickoffAt: string
  advancingTeam: number | null
}

function sharedFields(
  input: ClassicKnockoutBreakdownInput,
): Omit<
  LeaderboardPointBreakdownItem,
  'pointsAwarded' | 'reasonLabel' | 'lineId'
> {
  return {
    matchId: input.matchId,
    predTeam1: input.predTeam1,
    predTeam2: input.predTeam2,
    team1Name: input.team1Name,
    team2Name: input.team2Name,
    resultTeam1: input.resultTeam1,
    resultTeam2: input.resultTeam2,
    round: input.round,
    groupName: input.groupName,
    kickoffAt: input.kickoffAt,
  }
}

function fallbackLine(
  input: ClassicKnockoutBreakdownInput,
): LeaderboardPointBreakdownItem[] {
  if (input.pointsAwarded <= 0) {
    return []
  }

  return [
    {
      ...sharedFields(input),
      pointsAwarded: input.pointsAwarded,
      reasonLabel: 'Points awarded',
    },
  ]
}

/**
 * Split one classic knockout prediction into up to two display lines (exact + advance).
 * Sum of line points always equals pointsAwarded, or a single fallback line is returned.
 */
export function expandClassicKnockoutBreakdownLines(
  input: ClassicKnockoutBreakdownInput,
): LeaderboardPointBreakdownItem[] {
  if (!isKnockoutRound(input.round)) {
    return fallbackLine(input)
  }

  const round = input.round as KnockoutRoundId
  const values = KNOCKOUT_ROUND_POINT_VALUES[round]

  const exactHit =
    input.predTeam1 === input.resultTeam1 &&
    input.predTeam2 === input.resultTeam2

  const effectiveAdvance = resolveAdvancePickFromScores(
    input.predTeam1,
    input.predTeam2,
    input.advancePick,
  )

  const advanceHit =
    effectiveAdvance != null &&
    input.advancingTeam != null &&
    effectiveAdvance === input.advancingTeam

  const computedSum =
    (exactHit ? values.exact : 0) + (advanceHit ? values.advance : 0)

  if (computedSum !== input.pointsAwarded) {
    return fallbackLine(input)
  }

  if (computedSum === 0) {
    return []
  }

  const lines: LeaderboardPointBreakdownItem[] = []

  if (exactHit) {
    lines.push({
      ...sharedFields(input),
      lineId: `${input.matchId}:exact`,
      pointsAwarded: values.exact,
      reasonLabel: CLASSIC_KNOCKOUT_EXACT_REASON,
    })
  }

  if (advanceHit) {
    lines.push({
      ...sharedFields(input),
      lineId: `${input.matchId}:advance`,
      pointsAwarded: values.advance,
      reasonLabel: CLASSIC_KNOCKOUT_ADVANCE_REASON,
    })
  }

  return lines
}
