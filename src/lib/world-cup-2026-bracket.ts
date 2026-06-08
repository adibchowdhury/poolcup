import type {
  GroupRankings,
  WorldCupGroupLetter,
} from '@/src/lib/world-cup-groups'

export type BracketSide = 'left' | 'right'

export type R32SlotRef = {
  side: BracketSide
  matchIndex: number
  slot: 'home' | 'away'
}

export type GroupAdvanceFeed = {
  group: WorldCupGroupLetter
  rank: 1 | 2
  target: R32SlotRef
}

export type R32MatchupDef = {
  matchNumber: number
  label: string
  home: string
  away: string
}

/** Official FIFA World Cup 2026 Round of 32 — left geographic half (M73–M80). */
export const R32_LEFT: R32MatchupDef[] = [
  { matchNumber: 73, label: '2A vs 2B', home: '2A', away: '2B' },
  { matchNumber: 74, label: '1E vs 3rd', home: '1E', away: '3rd' },
  { matchNumber: 75, label: '1F vs 2C', home: '1F', away: '2C' },
  { matchNumber: 76, label: '1C vs 2F', home: '1C', away: '2F' },
  { matchNumber: 77, label: '1I vs 3rd', home: '1I', away: '3rd' },
  { matchNumber: 78, label: '2E vs 2I', home: '2E', away: '2I' },
  { matchNumber: 79, label: '1A vs 3rd', home: '1A', away: '3rd' },
  { matchNumber: 80, label: '1L vs 3rd', home: '1L', away: '3rd' },
]

/** Official FIFA World Cup 2026 Round of 32 — right geographic half (M81–M88). */
export const R32_RIGHT: R32MatchupDef[] = [
  { matchNumber: 81, label: '1D vs 3rd', home: '1D', away: '3rd' },
  { matchNumber: 82, label: '1G vs 3rd', home: '1G', away: '3rd' },
  { matchNumber: 83, label: '2K vs 2L', home: '2K', away: '2L' },
  { matchNumber: 84, label: '1H vs 2J', home: '1H', away: '2J' },
  { matchNumber: 85, label: '1B vs 3rd', home: '1B', away: '3rd' },
  { matchNumber: 86, label: '1J vs 2H', home: '1J', away: '2H' },
  { matchNumber: 87, label: '1K vs 3rd', home: '1K', away: '3rd' },
  { matchNumber: 88, label: '2D vs 2G', home: '2D', away: '2G' },
]

/** Fixed group-winner / runner-up paths into Round of 32 slots (FIFA 2026 draw). */
export const GROUP_ADVANCE_FEEDS: GroupAdvanceFeed[] = [
  { group: 'A', rank: 1, target: { side: 'left', matchIndex: 6, slot: 'home' } },
  { group: 'A', rank: 2, target: { side: 'left', matchIndex: 0, slot: 'home' } },
  { group: 'B', rank: 1, target: { side: 'right', matchIndex: 4, slot: 'home' } },
  { group: 'B', rank: 2, target: { side: 'left', matchIndex: 0, slot: 'away' } },
  { group: 'C', rank: 1, target: { side: 'left', matchIndex: 3, slot: 'home' } },
  { group: 'C', rank: 2, target: { side: 'left', matchIndex: 2, slot: 'away' } },
  { group: 'D', rank: 1, target: { side: 'right', matchIndex: 0, slot: 'home' } },
  { group: 'D', rank: 2, target: { side: 'right', matchIndex: 7, slot: 'home' } },
  { group: 'E', rank: 1, target: { side: 'left', matchIndex: 1, slot: 'home' } },
  { group: 'E', rank: 2, target: { side: 'left', matchIndex: 5, slot: 'home' } },
  { group: 'F', rank: 1, target: { side: 'left', matchIndex: 2, slot: 'home' } },
  { group: 'F', rank: 2, target: { side: 'left', matchIndex: 3, slot: 'away' } },
  { group: 'G', rank: 1, target: { side: 'right', matchIndex: 1, slot: 'home' } },
  { group: 'G', rank: 2, target: { side: 'right', matchIndex: 7, slot: 'away' } },
  { group: 'H', rank: 1, target: { side: 'right', matchIndex: 3, slot: 'home' } },
  { group: 'H', rank: 2, target: { side: 'right', matchIndex: 5, slot: 'away' } },
  { group: 'I', rank: 1, target: { side: 'left', matchIndex: 4, slot: 'home' } },
  { group: 'I', rank: 2, target: { side: 'left', matchIndex: 5, slot: 'away' } },
  { group: 'J', rank: 1, target: { side: 'right', matchIndex: 5, slot: 'home' } },
  { group: 'J', rank: 2, target: { side: 'right', matchIndex: 3, slot: 'away' } },
  { group: 'K', rank: 1, target: { side: 'right', matchIndex: 6, slot: 'home' } },
  { group: 'K', rank: 2, target: { side: 'right', matchIndex: 2, slot: 'home' } },
  { group: 'L', rank: 1, target: { side: 'left', matchIndex: 7, slot: 'home' } },
  { group: 'L', rank: 2, target: { side: 'right', matchIndex: 2, slot: 'away' } },
]

export const LEFT_GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export const RIGHT_GROUP_LETTERS = ['G', 'H', 'I', 'J', 'K', 'L'] as const

export const BRACKET_LAYOUT = {
  leftGroupColumnWidth: '18vw',
  leftR32ColumnWidth: '14vw',
  centerDividerWidth: '6vw',
  rightR32ColumnWidth: '14vw',
  rightGroupColumnWidth: '18vw',
  columnGap: 'calc((30vw - 96px) / 4)',
  r32SlotMinWidth: 120,
  connectorColor: '#2a3545',
} as const

/** Fallback draw when match data is unavailable. */
export const WC2026_DEFAULT_GROUPS: Record<WorldCupGroupLetter, string[]> = {
  A: ['Mexico', 'South Africa', 'South Korea', 'Czech Republic'],
  B: ['Canada', 'Switzerland', 'Qatar', 'Bosnia and Herzegovina'],
  C: ['Brazil', 'Morocco', 'Scotland', 'Haiti'],
  D: ['USA', 'Paraguay', 'Australia', 'Turkiye'],
  E: ['Germany', 'Ecuador', 'Ivory Coast', 'Curacao'],
  F: ['Netherlands', 'Japan', 'Tunisia', 'Sweden'],
  G: ['Belgium', 'Iran', 'Egypt', 'New Zealand'],
  H: ['Spain', 'Uruguay', 'Saudi Arabia', 'Cape Verde'],
  I: ['France', 'Senegal', 'Norway', 'Iraq'],
  J: ['Argentina', 'Austria', 'Algeria', 'Jordan'],
  K: ['Portugal', 'Colombia', 'Uzbekistan', 'DR Congo'],
  L: ['England', 'Croatia', 'Panama', 'Ghana'],
}

const RANK_ORDINALS = ['1st', '2nd', '3rd', '4th'] as const

export function rankOrdinal(rank: number): string {
  return RANK_ORDINALS[rank - 1] ?? `${rank}th`
}

export function groupSourceKey(
  group: WorldCupGroupLetter,
  rank: 1 | 2,
): string {
  return `${group}-${rank}`
}

export function r32TargetKey(target: R32SlotRef): string {
  return `${target.side}-${target.matchIndex}-${target.slot}`
}

export function isLeftGroup(group: WorldCupGroupLetter): boolean {
  return (LEFT_GROUP_LETTERS as readonly string[]).includes(group)
}

/**
 * FIFA Annex C combination 1 (E,F,G,H,I,J,K,L third-place teams advance):
 * which third-place group faces each group winner in Round of 32.
 */
export const R32_THIRD_OPPONENT_BY_WINNER: Record<string, WorldCupGroupLetter> =
  {
    '1A': 'E',
    '1B': 'J',
    '1D': 'F',
    '1E': 'I',
    '1G': 'H',
    '1I': 'G',
    '1K': 'L',
    '1L': 'K',
  }

/** Parse labels like 1A, 2B, 3C into group + finishing position. */
export function parseGroupPositionLabel(
  label: string,
): { group: WorldCupGroupLetter; rank: 1 | 2 | 3 } | null {
  const match = /^([123])([A-L])$/.exec(label)
  if (!match) return null
  const rank = Number(match[1]) as 1 | 2 | 3
  const group = match[2] as WorldCupGroupLetter
  return { group, rank }
}

/** Resolve a fixed group-position label (1A, 2B, 3C) to a team from standings. */
export function resolveGroupPositionTeam(
  label: string,
  groupRankings: GroupRankings,
): string | null {
  const parsed = parseGroupPositionLabel(label)
  if (!parsed) return null
  const standings = groupRankings[parsed.group] ?? []
  return standings[parsed.rank - 1] ?? null
}

/**
 * Resolve an R32 slot label to a team name.
 * For "3rd" away slots, pass the matchup home label (e.g. 1E) to apply Annex C mapping.
 */
export function resolveR32SlotTeam(
  slotLabel: string,
  groupRankings: GroupRankings,
  homeLabel?: string,
): string | null {
  if (slotLabel === '3rd') {
    if (!homeLabel) return null
    const thirdGroup = R32_THIRD_OPPONENT_BY_WINNER[homeLabel]
    if (!thirdGroup) return null
    const standings = groupRankings[thirdGroup] ?? []
    return standings[2] ?? null
  }
  return resolveGroupPositionTeam(slotLabel, groupRankings)
}

/** Build a map of R32 slot keys to populated team names from group rankings. */
export function buildR32PopulatedSlots(
  groupRankings: GroupRankings,
): Map<string, string> {
  const populated = new Map<string, string>()

  const processSide = (matchups: R32MatchupDef[], side: BracketSide) => {
    matchups.forEach((matchup, matchIndex) => {
      const homeTeam = resolveR32SlotTeam(matchup.home, groupRankings)
      if (homeTeam) {
        populated.set(
          r32TargetKey({ side, matchIndex, slot: 'home' }),
          homeTeam,
        )
      }

      const awayTeam = resolveR32SlotTeam(
        matchup.away,
        groupRankings,
        matchup.home,
      )
      if (awayTeam) {
        populated.set(
          r32TargetKey({ side, matchIndex, slot: 'away' }),
          awayTeam,
        )
      }
    })
  }

  processSide(R32_LEFT, 'left')
  processSide(R32_RIGHT, 'right')
  return populated
}
