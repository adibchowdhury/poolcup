import { sportDisplayLabel } from '@/src/lib/sport-display'

export type AnalyticsRange = '7d' | '30d' | 'season' | 'all'

export const ANALYTICS_RANGE_OPTIONS: Array<{
  value: AnalyticsRange
  label: string
  hint: string
}> = [
  { value: '7d', label: '7 days', hint: 'Last 7 days' },
  { value: '30d', label: '30 days', hint: 'Last 30 days' },
  {
    value: 'season',
    label: 'Season',
    hint: 'Current season (per sport)',
  },
  { value: 'all', label: 'All-time', hint: 'All finalized predictions' },
]

export type AnalyticsBySport = {
  sport: string
  finalized: number
  accuracy: number | null
  exact_rate: number | null
  points: number
}

export type AnalyticsByCompetition = {
  event_id: string | null
  event_name: string
  finalized: number
  accuracy: number | null
  exact_rate: number | null
  points: number
}

export type UserAnalytics = {
  finalized_predictions: number
  exact_count: number
  correct_count: number
  total_points: number
  accuracy: number | null
  exact_rate: number | null
  by_sport: AnalyticsBySport[]
  by_competition: AnalyticsByCompetition[]
  best_sport: string | null
  weakest_sport: string | null
}

export type AnalyticsComparisons = {
  poolcup_avg_accuracy: number | null
  friends_avg_accuracy: number | null
}

export type AnalyticsDailyPoint = {
  day: string
  accuracy: number | null
  points: number
  predictions: number
}

export type AnalyticsFormPoint = {
  seq: number
  rolling_accuracy: number | null
}

export type AnalyticsTimeseries = {
  daily: AnalyticsDailyPoint[]
  recent_form: AnalyticsFormPoint[]
}

export type AnalyticsBestRank = {
  best_rank: number | null
  best_rank_pool: string | null
  best_rank_pool_size: number | null
  pools_count: number
}

export type AnalyticsDateBounds = {
  dateFrom: string | null
  dateTo: string | null
  /** When true, RPCs scope to current-season events per sport (no date bounds). */
  seasonOnly: boolean
}

export function parseAnalyticsRange(
  raw: string | null | undefined,
): AnalyticsRange {
  if (raw === '7d' || raw === '30d' || raw === 'season' || raw === 'all') {
    return raw
  }
  return '30d'
}

/**
 * Resolve range → kickoff date bounds + p_season_only for analytics RPCs.
 * Season uses DB per-sport season windows (null dates + seasonOnly=true).
 */
export function analyticsRangeToBounds(
  range: AnalyticsRange,
  now = new Date(),
): AnalyticsDateBounds {
  if (range === 'all') {
    return { dateFrom: null, dateTo: null, seasonOnly: false }
  }

  if (range === 'season') {
    return { dateFrom: null, dateTo: null, seasonOnly: true }
  }

  const to = now.toISOString()
  if (range === '7d') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { dateFrom: from.toISOString(), dateTo: to, seasonOnly: false }
  }

  // 30d default
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { dateFrom: from.toISOString(), dateTo: to, seasonOnly: false }
}

export function formatAccuracyPercent(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '—'
  return `${Math.round(rate * 1000) / 10}%`
}

export function formatPoints(points: number | null | undefined): string {
  if (points == null || !Number.isFinite(points)) return '—'
  return Math.round(points).toLocaleString()
}

export function formatOrdinal(n: number): string {
  const abs = Math.abs(Math.floor(n))
  const mod100 = abs % 100
  if (mod100 >= 11 && mod100 <= 13) return `${abs}th`
  switch (abs % 10) {
    case 1:
      return `${abs}st`
    case 2:
      return `${abs}nd`
    case 3:
      return `${abs}rd`
    default:
      return `${abs}th`
  }
}

export function formatBestRankLabel(rank: AnalyticsBestRank): string {
  if (rank.best_rank == null || rank.best_rank_pool_size == null) {
    return '—'
  }
  return `${formatOrdinal(rank.best_rank)} of ${rank.best_rank_pool_size}`
}

export function formatSportLabel(sport: string | null | undefined): string {
  if (!sport?.trim()) return 'Sport'
  return sportDisplayLabel(sport)
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

export function coerceUserAnalytics(raw: unknown): UserAnalytics {
  const empty: UserAnalytics = {
    finalized_predictions: 0,
    exact_count: 0,
    correct_count: 0,
    total_points: 0,
    accuracy: null,
    exact_rate: null,
    by_sport: [],
    by_competition: [],
    best_sport: null,
    weakest_sport: null,
  }
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>

  const bySportRaw = Array.isArray(o.by_sport) ? o.by_sport : []
  const by_sport = bySportRaw
    .map((row): AnalyticsBySport | null => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const sport = typeof r.sport === 'string' ? r.sport : null
      if (!sport) return null
      return {
        sport,
        finalized: asInt(r.finalized),
        accuracy: asNumber(r.accuracy),
        exact_rate: asNumber(r.exact_rate),
        points: asInt(r.points),
      }
    })
    .filter((row): row is AnalyticsBySport => row != null)

  const byCompRaw = Array.isArray(o.by_competition) ? o.by_competition : []
  const by_competition = byCompRaw
    .map((row): AnalyticsByCompetition | null => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const event_name =
        typeof r.event_name === 'string' && r.event_name.trim()
          ? r.event_name.trim()
          : 'Competition'
      return {
        event_id: typeof r.event_id === 'string' ? r.event_id : null,
        event_name,
        finalized: asInt(r.finalized),
        accuracy: asNumber(r.accuracy),
        exact_rate: asNumber(r.exact_rate),
        points: asInt(r.points),
      }
    })
    .filter((row): row is AnalyticsByCompetition => row != null)

  return {
    finalized_predictions: asInt(o.finalized_predictions),
    exact_count: asInt(o.exact_count),
    correct_count: asInt(o.correct_count),
    total_points: asInt(o.total_points),
    accuracy: asNumber(o.accuracy),
    exact_rate: asNumber(o.exact_rate),
    by_sport,
    by_competition,
    best_sport: typeof o.best_sport === 'string' ? o.best_sport : null,
    weakest_sport: typeof o.weakest_sport === 'string' ? o.weakest_sport : null,
  }
}

export function coerceAnalyticsComparisons(raw: unknown): AnalyticsComparisons {
  if (!raw || typeof raw !== 'object') {
    return { poolcup_avg_accuracy: null, friends_avg_accuracy: null }
  }
  const o = raw as Record<string, unknown>
  return {
    poolcup_avg_accuracy: asNumber(o.poolcup_avg_accuracy),
    friends_avg_accuracy: asNumber(o.friends_avg_accuracy),
  }
}

export function coerceAnalyticsTimeseries(raw: unknown): AnalyticsTimeseries {
  if (!raw || typeof raw !== 'object') {
    return { daily: [], recent_form: [] }
  }
  const o = raw as Record<string, unknown>
  const dailyRaw = Array.isArray(o.daily) ? o.daily : []
  const daily = dailyRaw
    .map((row): AnalyticsDailyPoint | null => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const day = typeof r.day === 'string' ? r.day : null
      if (!day) return null
      return {
        day,
        accuracy: asNumber(r.accuracy),
        points: asInt(r.points),
        predictions: asInt(r.predictions),
      }
    })
    .filter((row): row is AnalyticsDailyPoint => row != null)

  const formRaw = Array.isArray(o.recent_form) ? o.recent_form : []
  const recent_form = formRaw
    .map((row): AnalyticsFormPoint | null => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const seq = asNumber(r.seq)
      if (seq == null) return null
      return {
        seq: Math.trunc(seq),
        rolling_accuracy: asNumber(r.rolling_accuracy),
      }
    })
    .filter((row): row is AnalyticsFormPoint => row != null)

  return { daily, recent_form }
}

export function coerceAnalyticsBestRank(raw: unknown): AnalyticsBestRank {
  if (!raw || typeof raw !== 'object') {
    return {
      best_rank: null,
      best_rank_pool: null,
      best_rank_pool_size: null,
      pools_count: 0,
    }
  }
  const o = raw as Record<string, unknown>
  return {
    best_rank: asNumber(o.best_rank) != null ? asInt(o.best_rank) : null,
    best_rank_pool:
      typeof o.best_rank_pool === 'string' ? o.best_rank_pool : null,
    best_rank_pool_size:
      asNumber(o.best_rank_pool_size) != null
        ? asInt(o.best_rank_pool_size)
        : null,
    pools_count: asInt(o.pools_count),
  }
}
