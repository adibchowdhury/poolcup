import type { BracketSide } from '@/src/lib/world-cup-2026-bracket'
import { r32MatchNumberForPreviewSlot } from '@/src/lib/r32-bracket-preview'

export type R32BracketMatchView = {
  matchId: string
  matchNumber: number
  team1Name: string
  team2Name: string
  lockedAt: string | null
  myPick: 1 | 2 | null
}

export type R32BracketMatchesByNumber = Map<number, R32BracketMatchView>

export const WINNER_ONLY_KNOCKOUT_PICK_TOTALS = {
  r32: 16,
  r16: 8,
  qf: 4,
  sf: 2,
  final: 1,
} as const

export function countR32AdvancePicks(
  matchesByNumber: R32BracketMatchesByNumber,
): number {
  let count = 0
  for (const match of matchesByNumber.values()) {
    if (match.myPick === 1 || match.myPick === 2) {
      count += 1
    }
  }
  return count
}

export function advancePickScores(pick: 1 | 2): {
  predTeam1: number
  predTeam2: number
} {
  return pick === 1 ? { predTeam1: 1, predTeam2: 0 } : { predTeam1: 0, predTeam2: 1 }
}

export function getR32PickedTeamName(
  match: R32BracketMatchView | undefined,
): string | null {
  if (!match || match.myPick == null) return null
  const name = match.myPick === 1 ? match.team1Name : match.team2Name
  const trimmed = name.trim()
  return trimmed || null
}

/** R16 card index within a half → visual R32 M-labels that feed top/bottom slots. */
export function r16FeederVisualLabels(
  half: BracketSide,
  r16Index: number,
): { top: string; bottom: string } {
  const topIndex = r16Index * 2
  const bottomIndex = topIndex + 1
  const topLabel =
    half === 'left' ? `M${topIndex + 1}` : `M${topIndex + 9}`
  const bottomLabel =
    half === 'left' ? `M${bottomIndex + 1}` : `M${bottomIndex + 9}`
  return { top: topLabel, bottom: bottomLabel }
}

/** Projected R16 sides from R32 advance picks (top ← first feeder, bottom ← second). */
export function getR16ProjectedSides(
  half: BracketSide,
  r16Index: number,
  matchesByNumber: R32BracketMatchesByNumber,
): { home: string | null; away: string | null } {
  const homeMatchNumber = r32MatchNumberForPreviewSlot(half, r16Index * 2)
  const awayMatchNumber = r32MatchNumberForPreviewSlot(half, r16Index * 2 + 1)
  const homeMatch =
    homeMatchNumber != null
      ? matchesByNumber.get(homeMatchNumber)
      : undefined
  const awayMatch =
    awayMatchNumber != null
      ? matchesByNumber.get(awayMatchNumber)
      : undefined

  return {
    home: getR32PickedTeamName(homeMatch),
    away: getR32PickedTeamName(awayMatch),
  }
}

/** Mobile hint: who the R32 winner faces next in R16 (display only). */
export function getR32R16AdvanceHint(
  half: BracketSide,
  index: number,
  matchesByNumber: R32BracketMatchesByNumber,
): string {
  const r16Index = Math.floor(index / 2)
  const isTopFeeder = index % 2 === 0
  const feeders = r16FeederVisualLabels(half, r16Index)
  const siblingIndex = isTopFeeder ? index + 1 : index - 1
  const siblingMatchNumber = r32MatchNumberForPreviewSlot(half, siblingIndex)
  const siblingMatch =
    siblingMatchNumber != null
      ? matchesByNumber.get(siblingMatchNumber)
      : undefined
  const opponentName = getR32PickedTeamName(siblingMatch)

  if (opponentName) {
    return `Winner plays ${opponentName}`
  }
  return `Winner plays winner of ${feeders.top}/${feeders.bottom}`
}
