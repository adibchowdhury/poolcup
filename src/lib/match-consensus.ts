/** Pro Crowd Win Chance / global match consensus (get_match_consensus). */

export type MatchConsensusOutcome = {
  team1WinPct: number
  drawPct: number
  team2WinPct: number
}

export type MatchConsensusTopScore = {
  score: string
  pct: number
}

export type MatchConsensusPayload =
  | { hasData: false; updatedAt: string | null }
  | {
      hasData: true
      updatedAt: string | null
      outcome: MatchConsensusOutcome
      topScores: MatchConsensusTopScore[]
    }

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Normalize 0–1 fractions to 0–100 percentages. */
function asPct(value: unknown): number | null {
  const n = asNumber(value)
  if (n == null) return null
  if (n >= 0 && n <= 1) return n * 100
  return n
}

export function parseMatchConsensusPayload(
  data: unknown,
): MatchConsensusPayload | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>

  const hasDataRaw = row.has_data ?? row.hasData
  const hasData =
    hasDataRaw === true ||
    hasDataRaw === 'true' ||
    hasDataRaw === 1

  const updatedAt =
    asString(row.updated_at) ?? asString(row.updatedAt) ?? null

  if (!hasData) {
    return { hasData: false, updatedAt }
  }

  const outcomeRaw = (row.outcome ?? row.Outcome) as
    | Record<string, unknown>
    | null
    | undefined

  const team1WinPct =
    asPct(outcomeRaw?.team1_win_pct) ??
    asPct(outcomeRaw?.team1WinPct) ??
    asPct(row.team1_win_pct)
  const drawPct =
    asPct(outcomeRaw?.draw_pct) ??
    asPct(outcomeRaw?.drawPct) ??
    asPct(row.draw_pct)
  const team2WinPct =
    asPct(outcomeRaw?.team2_win_pct) ??
    asPct(outcomeRaw?.team2WinPct) ??
    asPct(row.team2_win_pct)

  if (team1WinPct == null || drawPct == null || team2WinPct == null) {
    return { hasData: false, updatedAt }
  }

  const topRaw = row.top_scores ?? row.topScores
  const topScores: MatchConsensusTopScore[] = []
  if (Array.isArray(topRaw)) {
    for (const item of topRaw) {
      if (!item || typeof item !== 'object') continue
      const s = item as Record<string, unknown>
      const score = asString(s.score)
      const pct = asPct(s.pct) ?? asPct(s.percent)
      if (!score || pct == null) continue
      topScores.push({ score, pct })
    }
  }

  return {
    hasData: true,
    updatedAt,
    outcome: { team1WinPct, drawPct, team2WinPct },
    topScores: topScores.slice(0, 3),
  }
}

/** Relative "updated Xs ago" for consensus refresh stamp. */
export function formatConsensusUpdatedAt(
  iso: string | null,
  nowMs = Date.now(),
): string {
  if (!iso) return 'Updated just now'
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return 'Updated just now'
  const sec = Math.max(0, Math.floor((nowMs - then) / 1000))
  if (sec < 5) return 'Updated just now'
  if (sec < 60) return `Updated ${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `Updated ${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `Updated ${hr}h ago`
  return `Updated ${Math.floor(hr / 24)}d ago`
}
