import {
  R32_LEFT,
  R32_RIGHT,
  type BracketSide,
} from '@/src/lib/world-cup-2026-bracket'

export type R32BracketMatchRow = {
  id: string
  match_number: number
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  kickoff_at: string
  status_short: string | null
  fixture_id: string | null
}

/** Preview label (M1..M16) → FIFA match_number for the R32 source column. */
export function r32MatchNumberForPreviewSlot(
  half: BracketSide,
  index: number,
): number | null {
  const matchups = half === 'left' ? R32_LEFT : R32_RIGHT
  return matchups[index]?.matchNumber ?? null
}

export function isResolvedR32Team(name: string | null | undefined): boolean {
  const normalizedName = (name ?? '').trim()
  if (!normalizedName) return false

  if (/^winner\s/i.test(normalizedName)) return false
  if (/^runner[- ]?up\s/i.test(normalizedName)) return false
  if (/^best 3rd/i.test(normalizedName)) return false

  return true
}

export const R32_PREVIEW_SLOT_TO_MATCH_NUMBER: ReadonlyArray<{
  visualLabel: string
  half: BracketSide
  index: number
  matchNumber: number
  homeSlot: 'team1'
  awaySlot: 'team2'
}> = [
  ...R32_LEFT.map((matchup, index) => ({
    visualLabel: `M${index + 1}`,
    half: 'left' as const,
    index,
    matchNumber: matchup.matchNumber,
    homeSlot: 'team1' as const,
    awaySlot: 'team2' as const,
  })),
  ...R32_RIGHT.map((matchup, index) => ({
    visualLabel: `M${index + 9}`,
    half: 'right' as const,
    index,
    matchNumber: matchup.matchNumber,
    homeSlot: 'team1' as const,
    awaySlot: 'team2' as const,
  })),
]
