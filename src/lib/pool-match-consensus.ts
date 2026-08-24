/** Post-lock per-pool match consensus (get_pool_match_consensus) — includes counts. */

export type PoolMatchConsensusOutcome = {
  team1WinPct: number
  drawPct: number
  team2WinPct: number
}

export type PoolMatchConsensusTopScore = {
  score: string
  count: number
  pct: number
}

export type PoolMatchConsensusPayload =
  | {
      hasData: false
      totalPredictions: number
      updatedAt: string | null
    }
  | {
      hasData: true
      totalPredictions: number
      updatedAt: string | null
      outcome: PoolMatchConsensusOutcome
      topScores: PoolMatchConsensusTopScore[]
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

function asPct(value: unknown): number | null {
  const n = asNumber(value)
  if (n == null) return null
  if (n >= 0 && n <= 1) return n * 100
  return n
}

export function parsePoolMatchConsensusPayload(
  data: unknown,
): PoolMatchConsensusPayload | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>

  const hasDataRaw = row.has_data ?? row.hasData
  const hasData =
    hasDataRaw === true || hasDataRaw === 'true' || hasDataRaw === 1

  const totalPredictions =
    asNumber(row.total_predictions) ??
    asNumber(row.totalPredictions) ??
    asNumber(row.total) ??
    0

  const updatedAt =
    asString(row.updated_at) ?? asString(row.updatedAt) ?? null

  if (!hasData) {
    return {
      hasData: false,
      totalPredictions: totalPredictions ?? 0,
      updatedAt,
    }
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
    return {
      hasData: false,
      totalPredictions: totalPredictions ?? 0,
      updatedAt,
    }
  }

  const topRaw = row.top_scores ?? row.topScores
  const topScores: PoolMatchConsensusTopScore[] = []
  if (Array.isArray(topRaw)) {
    for (const item of topRaw) {
      if (!item || typeof item !== 'object') continue
      const s = item as Record<string, unknown>
      const score = asString(s.score)
      const pct = asPct(s.pct) ?? asPct(s.percent)
      const count = asNumber(s.count) ?? asNumber(s.cnt) ?? 0
      if (!score || pct == null) continue
      topScores.push({ score, count: count ?? 0, pct })
    }
  }

  return {
    hasData: true,
    totalPredictions: totalPredictions ?? 0,
    updatedAt,
    outcome: { team1WinPct, drawPct, team2WinPct },
    topScores: topScores.slice(0, 5),
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
