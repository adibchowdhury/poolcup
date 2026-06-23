import {
  isKnockoutRound,
  type KnockoutRoundId,
} from '@/src/lib/classic-round-tab-logic'

export const KNOCKOUT_ROUND_POINT_VALUES = {
  r32: { exact: 7, advance: 3 },
  r16: { exact: 10, advance: 4 },
  qf: { exact: 12, advance: 5 },
  sf: { exact: 15, advance: 6 },
  final: { exact: 20, advance: 8 },
} as const satisfies Record<
  KnockoutRoundId,
  { exact: number; advance: number }
>

export function formatKnockoutPointValuesFooter(round: KnockoutRoundId): string {
  const values = KNOCKOUT_ROUND_POINT_VALUES[round]
  return `+${values.exact} exact / +${values.advance} advance`
}

export function isPredictedDraw(
  predTeam1: number,
  predTeam2: number,
): boolean {
  return predTeam1 === predTeam2
}

export function getAdvancePickHintText(isDraw: boolean): string {
  return isDraw
    ? 'You predicted a draw, so this decides it'
    : "If it's level and goes to penalties"
}

export function isKnockoutPredictionComplete(
  round: string,
  predTeam1: number | null,
  predTeam2: number | null,
  advancePick: number | null,
): boolean {
  if (predTeam1 == null || predTeam2 == null) return false
  if (!isKnockoutRound(round)) return true
  if (!isPredictedDraw(predTeam1, predTeam2)) return true
  return advancePick === 1 || advancePick === 2
}

export function resolveAdvancePickTeamName(
  advancePick: number | null,
  team1Name: string,
  team2Name: string,
): string | null {
  if (advancePick === 1) return team1Name
  if (advancePick === 2) return team2Name
  return null
}
