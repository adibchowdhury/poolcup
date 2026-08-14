import { sportDisplayLabel } from '@/src/lib/sport-display'

export const HISTORY_PAGE_SIZE = 25

export type PredictionHistoryOutcome =
  | 'exact'
  | 'correct'
  | 'incorrect'
  | 'pending'

export type PredictionHistoryRow = {
  prediction_id: string
  match_id: string
  pool_id: string
  pool_name: string | null
  sport: string | null
  event_name: string | null
  round: string | null
  team1_name: string | null
  team2_name: string | null
  kickoff_at: string | null
  predicted: string | null
  actual_result: string | null
  is_final: boolean | null
  points_awarded: number
  outcome: PredictionHistoryOutcome | string
  total_count: number
}

export type HistoryFilterOptions = {
  sports: Array<{ value: string; label: string }>
  events: Array<{ id: string; name: string }>
  pools: Array<{ id: string; name: string }>
}

export type HistoryFilters = {
  sport: string | null
  eventId: string | null
  poolId: string | null
  result: PredictionHistoryOutcome | null
  dateFrom: string | null
  dateTo: string | null
  q: string | null
  page: number
}

export const RESULT_FILTER_OPTIONS: Array<{
  value: '' | PredictionHistoryOutcome
  label: string
}> = [
  { value: '', label: 'All results' },
  { value: 'exact', label: 'Exact' },
  { value: 'correct', label: 'Correct' },
  { value: 'incorrect', label: 'Incorrect' },
  { value: 'pending', label: 'Pending' },
]

export function parseHistoryFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): HistoryFilters {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      const v = params.get(key)?.trim()
      return v || null
    }
    const raw = params[key]
    const v = Array.isArray(raw) ? raw[0] : raw
    const trimmed = typeof v === 'string' ? v.trim() : ''
    return trimmed || null
  }

  const resultRaw = get('result')
  const result =
    resultRaw === 'exact' ||
    resultRaw === 'correct' ||
    resultRaw === 'incorrect' ||
    resultRaw === 'pending'
      ? resultRaw
      : null

  const pageRaw = Number(get('page') ?? '1')
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1

  return {
    sport: get('sport'),
    eventId: get('event'),
    poolId: get('pool'),
    result,
    dateFrom: get('from'),
    dateTo: get('to'),
    q: get('q'),
    page,
  }
}

/** Build URLSearchParams for Pro filter state (omits empty + page 1). */
export function historyFiltersToSearchParams(
  filters: HistoryFilters,
): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.sport) qs.set('sport', filters.sport)
  if (filters.eventId) qs.set('event', filters.eventId)
  if (filters.poolId) qs.set('pool', filters.poolId)
  if (filters.result) qs.set('result', filters.result)
  if (filters.dateFrom) qs.set('from', filters.dateFrom)
  if (filters.dateTo) qs.set('to', filters.dateTo)
  if (filters.q) qs.set('q', filters.q)
  if (filters.page > 1) qs.set('page', String(filters.page))
  return qs
}

export function historyHasActiveFilters(filters: HistoryFilters): boolean {
  return Boolean(
    filters.sport ||
      filters.eventId ||
      filters.poolId ||
      filters.result ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.q,
  )
}

export function formatHistorySportLabel(sport: string | null): string {
  if (!sport?.trim()) return 'Sport'
  return sportDisplayLabel(sport)
}

/**
 * Normalize get_prediction_history_filter_options jsonb into dropdown options.
 * RPC shape: { sports: string[], events: [{id,name}], pools: [{id,name}] }
 */
export function coerceHistoryFilterOptions(
  raw: unknown,
): HistoryFilterOptions {
  const empty: HistoryFilterOptions = { sports: [], events: [], pools: [] }
  if (!raw || typeof raw !== 'object') return empty
  const obj = raw as Record<string, unknown>

  const sportsRaw = Array.isArray(obj.sports) ? obj.sports : []
  const sports = sportsRaw
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((value) => ({
      value,
      label: sportDisplayLabel(value),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const eventsRaw = Array.isArray(obj.events) ? obj.events : []
  const events = eventsRaw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const ev = row as Record<string, unknown>
      const id = typeof ev.id === 'string' ? ev.id : null
      if (!id) return null
      const name =
        typeof ev.name === 'string' && ev.name.trim()
          ? ev.name.trim()
          : 'Competition'
      return { id, name }
    })
    .filter((row): row is { id: string; name: string } => row != null)
    .sort((a, b) => a.name.localeCompare(b.name))

  const poolsRaw = Array.isArray(obj.pools) ? obj.pools : []
  const pools = poolsRaw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const p = row as Record<string, unknown>
      const id = typeof p.id === 'string' ? p.id : null
      if (!id) return null
      const name =
        typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Pool'
      return { id, name }
    })
    .filter((row): row is { id: string; name: string } => row != null)
    .sort((a, b) => a.name.localeCompare(b.name))

  return { sports, events, pools }
}

export function coerceHistoryRow(raw: unknown): PredictionHistoryRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const predictionId =
    typeof row.prediction_id === 'string' ? row.prediction_id : null
  const matchId = typeof row.match_id === 'string' ? row.match_id : null
  const poolId = typeof row.pool_id === 'string' ? row.pool_id : null
  if (!predictionId || !matchId || !poolId) return null

  const totalRaw = row.total_count
  const total =
    typeof totalRaw === 'number'
      ? totalRaw
      : typeof totalRaw === 'string'
        ? Number(totalRaw)
        : 0

  const pointsRaw = row.points_awarded
  const points =
    typeof pointsRaw === 'number'
      ? pointsRaw
      : typeof pointsRaw === 'string'
        ? Number(pointsRaw)
        : 0

  return {
    prediction_id: predictionId,
    match_id: matchId,
    pool_id: poolId,
    pool_name: typeof row.pool_name === 'string' ? row.pool_name : null,
    sport: typeof row.sport === 'string' ? row.sport : null,
    event_name: typeof row.event_name === 'string' ? row.event_name : null,
    round: typeof row.round === 'string' ? row.round : null,
    team1_name: typeof row.team1_name === 'string' ? row.team1_name : null,
    team2_name: typeof row.team2_name === 'string' ? row.team2_name : null,
    kickoff_at: typeof row.kickoff_at === 'string' ? row.kickoff_at : null,
    predicted: typeof row.predicted === 'string' ? row.predicted : null,
    actual_result:
      typeof row.actual_result === 'string' ? row.actual_result : null,
    is_final: typeof row.is_final === 'boolean' ? row.is_final : null,
    points_awarded: Number.isFinite(points) ? points : 0,
    outcome: typeof row.outcome === 'string' ? row.outcome : 'pending',
    total_count: Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0,
  }
}
