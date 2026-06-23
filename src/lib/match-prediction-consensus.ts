import type { MatchPredictionDistribution } from '@/src/lib/match-prediction-distribution'

export type OutcomeKey = 'team1_win' | 'draw' | 'team2_win'

export type OutcomeRow = {
  key: OutcomeKey
  label: string
  count: number
  pct: number
}

export type DominantOutcome = OutcomeRow

export function buildOutcomeRows(
  outcomes: MatchPredictionDistribution['outcomes'],
  team1Name: string,
  team2Name: string,
  total: number,
): OutcomeRow[] {
  const rows: OutcomeRow[] = [
    {
      key: 'team1_win',
      label: `${team1Name} win`,
      count: outcomes.team1_win,
      pct: total > 0 ? Math.round((outcomes.team1_win / total) * 100) : 0,
    },
    {
      key: 'draw',
      label: 'Draw',
      count: outcomes.draw,
      pct: total > 0 ? Math.round((outcomes.draw / total) * 100) : 0,
    },
    {
      key: 'team2_win',
      label: `${team2Name} win`,
      count: outcomes.team2_win,
      pct: total > 0 ? Math.round((outcomes.team2_win / total) * 100) : 0,
    },
  ]

  return rows.sort((a, b) => b.count - a.count)
}

export function getDominantOutcome(rows: OutcomeRow[]): DominantOutcome | null {
  if (rows.length === 0 || rows[0].count === 0) return null
  return rows[0]
}

export function getConsensusConfidenceLabel(maxShare: number): string {
  if (maxShare >= 0.7) return 'Most players agree'
  if (maxShare >= 0.55) return 'Strong agreement'
  if (maxShare >= 0.42) return 'A slight lean'
  return 'Split opinions'
}

export function getPlayersAgreeLabel(agreePercent: number): string {
  if (agreePercent > 0) return `${agreePercent}% of players agree`
  return 'Strong community consensus'
}

export function getConsensusConfidenceLevel(maxShare: number): number {
  return Math.round(Math.min(100, Math.max(0, maxShare * 100)))
}
