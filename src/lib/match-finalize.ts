import type { ApiFootballFixture } from '@/src/lib/api-football'
import {
  parseAdvancingTeam,
  parseFixtureGoals,
} from '@/src/lib/api-football'
import { isKnockoutRound } from '@/src/lib/classic-round-tab-logic'

export type AdvancingTeamSide = 1 | 2

/** Knockout finalize is blocked when the score is level but no advancer can be resolved. */
export function isKnockoutFinalizeBlocked(
  resultTeam1: number,
  resultTeam2: number,
  advancingTeam: AdvancingTeamSide | null,
): boolean {
  return resultTeam1 === resultTeam2 && advancingTeam == null
}

export function resolveKnockoutAdvancingTeamFromFixture(
  fixture: ApiFootballFixture,
): AdvancingTeamSide | null {
  return parseAdvancingTeam(fixture)
}

export function resolveKnockoutAdvancingTeamFromScores(
  resultTeam1: number,
  resultTeam2: number,
  explicitAdvancingTeam?: number | null,
): AdvancingTeamSide | null {
  if (resultTeam1 > resultTeam2) return 1
  if (resultTeam2 > resultTeam1) return 2
  if (explicitAdvancingTeam === 1 || explicitAdvancingTeam === 2) {
    return explicitAdvancingTeam
  }
  return null
}

export type KnockoutFinalizeFields = {
  advancing_team: AdvancingTeamSide
}

/**
 * Advancing team for a knockout match finalize. Returns null when the score is
 * level and the winner cannot be determined (caller must not set is_final).
 */
export function knockoutFinalizeFieldsFromFixture(
  round: string,
  fixture: ApiFootballFixture,
): KnockoutFinalizeFields | null {
  if (!isKnockoutRound(round)) return null

  const goals = parseFixtureGoals(fixture)
  if (!goals) return null

  const advancingTeam = parseAdvancingTeam(fixture)
  if (isKnockoutFinalizeBlocked(goals.resultTeam1, goals.resultTeam2, advancingTeam)) {
    return null
  }

  return { advancing_team: advancingTeam! }
}

export function knockoutFinalizeFieldsFromScores(
  round: string,
  resultTeam1: number,
  resultTeam2: number,
  explicitAdvancingTeam?: number | null,
): KnockoutFinalizeFields | null {
  if (!isKnockoutRound(round)) return null

  const advancingTeam = resolveKnockoutAdvancingTeamFromScores(
    resultTeam1,
    resultTeam2,
    explicitAdvancingTeam,
  )
  if (isKnockoutFinalizeBlocked(resultTeam1, resultTeam2, advancingTeam)) {
    return null
  }

  return { advancing_team: advancingTeam! }
}
