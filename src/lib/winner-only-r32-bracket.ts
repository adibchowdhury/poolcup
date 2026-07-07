import type { BracketSide } from '@/src/lib/world-cup-2026-bracket'
import { r32MatchNumberForPreviewSlot } from '@/src/lib/r32-bracket-preview'

export type R32BracketMatchView = {
  matchId: string
  matchNumber: number
  team1Name: string
  team2Name: string
  kickoffAt: string | null
  lockedAt: string | null
  myPick: 1 | 2 | null
  savedPick: 1 | 2 | null
}

export type R32BracketMatchesByNumber = Map<number, R32BracketMatchView>

/** Shared knockout-round bracket props (R32, R16, …). */
export type KnockoutRoundBracketProps = {
  matchesByNumber: R32BracketMatchesByNumber
  nowMs: number
  onAdvancePick: (matchId: string, pick: 1 | 2) => void
}

export const R16_BRACKET_SLOT_POSITIONS: Array<{
  half: BracketSide
  index: number
}> = [
  ...Array.from({ length: 4 }, (_, index) => ({
    half: 'left' as const,
    index,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    half: 'right' as const,
    index,
  })),
]

export type WinnerKnockoutDisplayRound = 'r16' | 'qf' | 'sf' | 'final'

export const QF_BRACKET_SLOT_POSITIONS: Array<{
  half: BracketSide
  index: number
}> = [
  { half: 'left', index: 0 },
  { half: 'left', index: 1 },
  { half: 'right', index: 0 },
  { half: 'right', index: 1 },
]

export const SF_BRACKET_SLOT_POSITIONS: Array<{
  half: BracketSide
  index: number
}> = [
  { half: 'left', index: 0 },
  { half: 'right', index: 0 },
]

export const FINAL_BRACKET_SLOT_POSITIONS: Array<{
  half: BracketSide
  index: number
}> = [{ half: 'left', index: 0 }]

export const WINNER_KNOCKOUT_SLOT_POSITIONS: Record<
  WinnerKnockoutDisplayRound,
  Array<{ half: BracketSide; index: number }>
> = {
  r16: R16_BRACKET_SLOT_POSITIONS,
  qf: QF_BRACKET_SLOT_POSITIONS,
  sf: SF_BRACKET_SLOT_POSITIONS,
  final: FINAL_BRACKET_SLOT_POSITIONS,
}

export function knockoutSlotLabel(
  round: WinnerKnockoutDisplayRound,
  half: BracketSide,
  index: number,
): string {
  switch (round) {
    case 'r16':
      return half === 'left' ? `R16 M${index + 1}` : `R16 M${index + 5}`
    case 'qf':
      return half === 'left' ? `QF M${index + 1}` : `QF M${index + 3}`
    case 'sf':
      return half === 'left' ? 'SF M1' : 'SF M2'
    case 'final':
      return 'Final'
  }
}

export function r16SlotLabel(half: BracketSide, index: number): string {
  return knockoutSlotLabel('r16', half, index)
}

/** Real knockout DB rows mapped to visual slot order; missing slots are null. */
export function buildKnockoutRoundTabDisplayRows(
  round: WinnerKnockoutDisplayRound,
  matchesByNumber: R32BracketMatchesByNumber,
): Array<{ slotLabel: string; match: R32BracketMatchView | null }> {
  const positions = WINNER_KNOCKOUT_SLOT_POSITIONS[round]
  const sorted = [...matchesByNumber.values()].sort(
    (a, b) => a.matchNumber - b.matchNumber,
  )

  return positions.map(({ half, index }, slotIndex) => ({
    slotLabel: knockoutSlotLabel(round, half, index),
    match: slotIndex < sorted.length ? (sorted[slotIndex] ?? null) : null,
  }))
}

/** Real R16 DB rows mapped to bracket slot order; missing slots are null. */
export function buildR16TabDisplayRows(
  matchesByNumber: R32BracketMatchesByNumber,
): Array<{ slotLabel: string; match: R32BracketMatchView | null }> {
  return buildKnockoutRoundTabDisplayRows('r16', matchesByNumber)
}

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

/** Picks required for a real-row knockout tab (DB rows only; TBD slots excluded). */
export function winnerKnockoutPickTotalForMatches(
  round: WinnerKnockoutDisplayRound,
  matchesByNumber: R32BracketMatchesByNumber,
): number {
  const rowCount = matchesByNumber.size
  if (rowCount > 0) return rowCount
  return WINNER_ONLY_KNOCKOUT_PICK_TOTALS[round]
}

export function isWinnerKnockoutRoundComplete(
  round: WinnerKnockoutDisplayRound,
  matchesByNumber: R32BracketMatchesByNumber,
): boolean {
  const total = winnerKnockoutPickTotalForMatches(round, matchesByNumber)
  if (total === 0) return false
  return countR32AdvancePicks(matchesByNumber) >= total
}

export function isR32MatchLocked(
  match: R32BracketMatchView | undefined,
  nowMs: number,
): boolean {
  return (
    match?.lockedAt != null && new Date(match.lockedAt).getTime() <= nowMs
  )
}

export function isR32PickPersisted(match: R32BracketMatchView | undefined): boolean {
  const savedPick = match?.savedPick
  return savedPick === 1 || savedPick === 2
}

export function countR32UnsavedPicks(
  matchesByNumber: R32BracketMatchesByNumber,
  nowMs: number,
): number {
  let count = 0
  for (const match of matchesByNumber.values()) {
    if (isR32MatchLocked(match, nowMs)) continue
    if (match.myPick !== match.savedPick) count += 1
  }
  return count
}

export function advancePickScores(pick: 1 | 2): {
  predTeam1: number
  predTeam2: number
} {
  return pick === 1 ? { predTeam1: 1, predTeam2: 0 } : { predTeam1: 0, predTeam2: 1 }
}

/** Real DB row for a visual bracket slot (half + index), or null if TBD. */
export function getKnockoutMatchForVisualSlot(
  round: WinnerKnockoutDisplayRound,
  half: BracketSide,
  index: number,
  matchesByNumber: R32BracketMatchesByNumber,
): R32BracketMatchView | null {
  const slotIndex = WINNER_KNOCKOUT_SLOT_POSITIONS[round].findIndex(
    (pos) => pos.half === half && pos.index === index,
  )
  if (slotIndex < 0) return null
  const rows = buildKnockoutRoundTabDisplayRows(round, matchesByNumber)
  return rows[slotIndex]?.match ?? null
}

/** Real R16 DB row for a visual bracket slot (half + index), or null if TBD. */
export function getR16MatchForVisualSlot(
  half: BracketSide,
  index: number,
  matchesByNumber: R32BracketMatchesByNumber,
): R32BracketMatchView | null {
  return getKnockoutMatchForVisualSlot('r16', half, index, matchesByNumber)
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
