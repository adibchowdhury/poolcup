import {
  formatAccuracyPercent,
  formatOrdinal,
  formatPoints,
  formatSportLabel,
} from '@/src/lib/analytics'

export {
  formatAccuracyPercent,
  formatOrdinal,
  formatPoints,
  formatSportLabel,
}

export type HistoricalSeasonRow = {
  event_id: string
  season: string
  sport: string | null
  season_start: string | null
  finalized: number
  accuracy: number | null
  exact_count: number
  points: number
  best_rank: number | null
  pool_size: number | null
}

export type HistoricalYearRow = {
  year: number
  finalized: number
  accuracy: number | null
  exact_count: number
  points: number
}

export type HistoricalAllTime = {
  finalized: number
  accuracy: number | null
  exact_count: number
  points: number
  seasons_played: number
}

export type HistoricalRankEntry = {
  best_rank: number | null
  pool_size: number | null
}

function asNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) {
    return Number(raw)
  }
  return null
}

function asInt(raw: unknown, fallback = 0): number {
  const n = asNumber(raw)
  return n == null ? fallback : Math.trunc(n)
}

export function formatHistoricalRank(
  bestRank: number | null,
  poolSize: number | null,
): string {
  if (bestRank == null || poolSize == null) return '—'
  return `${formatOrdinal(bestRank)} of ${poolSize}`
}

export function coerceHistoricalAllTime(raw: unknown): HistoricalAllTime {
  if (!raw || typeof raw !== 'object') {
    return {
      finalized: 0,
      accuracy: null,
      exact_count: 0,
      points: 0,
      seasons_played: 0,
    }
  }
  const o = raw as Record<string, unknown>
  return {
    finalized: asInt(o.finalized),
    accuracy: asNumber(o.accuracy),
    exact_count: asInt(o.exact_count),
    points: asInt(o.points),
    seasons_played: asInt(o.seasons_played),
  }
}

export function coerceHistoricalByYear(raw: unknown): HistoricalYearRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row): HistoricalYearRow | null => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const year = asNumber(r.year)
      if (year == null) return null
      return {
        year: Math.trunc(year),
        finalized: asInt(r.finalized),
        accuracy: asNumber(r.accuracy),
        exact_count: asInt(r.exact_count),
        points: asInt(r.points),
      }
    })
    .filter((row): row is HistoricalYearRow => row != null)
}

export function coerceHistoricalRankBySeason(
  raw: unknown,
): Record<string, HistoricalRankEntry> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, HistoricalRankEntry> = {}
  for (const [eventId, entry] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!eventId || !entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const best = asNumber(e.best_rank)
    const size = asNumber(e.pool_size)
    out[eventId] = {
      best_rank: best == null ? null : Math.trunc(best),
      pool_size: size == null ? null : Math.trunc(size),
    }
  }
  return out
}

export function coerceHistoricalBySeason(
  raw: unknown,
  ranks: Record<string, HistoricalRankEntry> = {},
): HistoricalSeasonRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row): HistoricalSeasonRow | null => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const eventId = typeof r.event_id === 'string' ? r.event_id : null
      if (!eventId) return null
      const rank = ranks[eventId]
      return {
        event_id: eventId,
        season:
          typeof r.season === 'string' && r.season.trim()
            ? r.season.trim()
            : 'Season',
        sport: typeof r.sport === 'string' ? r.sport : null,
        season_start:
          typeof r.season_start === 'string' ? r.season_start : null,
        finalized: asInt(r.finalized),
        accuracy: asNumber(r.accuracy),
        exact_count: asInt(r.exact_count),
        points: asInt(r.points),
        best_rank: rank?.best_rank ?? null,
        pool_size: rank?.pool_size ?? null,
      }
    })
    .filter((row): row is HistoricalSeasonRow => row != null)
}

export function deltaNumber(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return null
  }
  return a - b
}

export function formatDeltaAccuracy(
  a: number | null,
  b: number | null,
): string {
  const d = deltaNumber(a, b)
  if (d == null) return '—'
  const pct = Math.round(d * 1000) / 10
  if (pct === 0) return '0%'
  return `${pct > 0 ? '+' : ''}${pct}%`
}

export function formatDeltaInt(a: number | null, b: number | null): string {
  const d = deltaNumber(a, b)
  if (d == null) return '—'
  const n = Math.round(d)
  if (n === 0) return '0'
  return `${n > 0 ? '+' : ''}${n.toLocaleString()}`
}
