import { advancePickScores } from '@/src/lib/winner-only-r32-bracket'

export type WinnerPick = 'team1' | 'team2' | 'draw'

export type EncodedWinnerPick = {
  predTeam1: number
  predTeam2: number
  advancePick: number | null
}

/** Soccer/football/hockey league matches can end in a draw; knockout rounds cannot. */
export function sportAllowsDraw(sport: string | null | undefined): boolean {
  const normalized = sport?.trim().toLowerCase() ?? ''
  return (
    normalized === 'soccer' ||
    normalized === 'football' ||
    normalized === 'hockey' ||
    normalized === 'nhl'
  )
}

export function encodeWinnerPick(
  pick: WinnerPick,
  isKnockout: boolean,
): EncodedWinnerPick {
  if (isKnockout) {
    const advancePick = pick === 'team1' ? 1 : 2
    const scores = advancePickScores(advancePick as 1 | 2)
    return { ...scores, advancePick }
  }

  switch (pick) {
    case 'team1':
      return { predTeam1: 1, predTeam2: 0, advancePick: null }
    case 'team2':
      return { predTeam1: 0, predTeam2: 1, advancePick: null }
    case 'draw':
      return { predTeam1: 1, predTeam2: 1, advancePick: null }
  }
}

export function decodeWinnerPick(
  predTeam1: number | null,
  predTeam2: number | null,
  advancePick: number | null,
  isKnockout: boolean,
): WinnerPick | null {
  if (predTeam1 != null && predTeam2 != null) {
    if (predTeam1 === predTeam2) return 'draw'
    if (predTeam1 > predTeam2) return 'team1'
    if (predTeam2 > predTeam1) return 'team2'
  }

  if (isKnockout && (advancePick === 1 || advancePick === 2)) {
    return advancePick === 1 ? 'team1' : 'team2'
  }

  return null
}

export function hasWinnerPick(
  predTeam1: number | null,
  predTeam2: number | null,
  advancePick: number | null,
  isKnockout: boolean,
): boolean {
  return decodeWinnerPick(predTeam1, predTeam2, advancePick, isKnockout) != null
}

export function winnerPickLabel(
  pick: WinnerPick,
  team1Name: string,
  team2Name: string,
): string {
  switch (pick) {
    case 'team1':
      return team1Name
    case 'team2':
      return team2Name
    case 'draw':
      return 'Draw'
  }
}
