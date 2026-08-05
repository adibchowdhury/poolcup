import type { SupabaseClient } from '@supabase/supabase-js'

export type PlatformStats = {
  total_users: number
  total_predictions: number
  total_pools: number
  total_events: number
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Round DOWN to a clean threshold (never overstates). */
export function floorToNearest(value: number, step: number): number {
  if (!Number.isFinite(value) || value < 0 || step <= 0) return 0
  return Math.floor(value / step) * step
}

export function formatCountWithPlus(value: number): string {
  return `${Math.max(0, Math.floor(value)).toLocaleString('en-US')}+`
}

function coercePlatformStats(raw: unknown): PlatformStats | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>

  const total_users = asNumber(row.total_users)
  const total_predictions = asNumber(row.total_predictions)
  const total_pools = asNumber(row.total_pools)
  const total_events = asNumber(row.total_events)

  if (
    total_users == null ||
    total_predictions == null ||
    total_pools == null ||
    total_events == null
  ) {
    return null
  }

  return {
    total_users: Math.max(0, Math.floor(total_users)),
    total_predictions: Math.max(0, Math.floor(total_predictions)),
    total_pools: Math.max(0, Math.floor(total_pools)),
    total_events: Math.max(0, Math.floor(total_events)),
  }
}

export async function fetchPlatformStats(
  supabase: SupabaseClient,
): Promise<PlatformStats | null> {
  const { data, error } = await supabase.rpc('get_platform_stats')

  if (error) {
    console.error('get_platform_stats failed:', error.message)
    return null
  }

  // RPC may return a single object or a one-row array depending on definition.
  const raw = Array.isArray(data) ? data[0] : data
  return coercePlatformStats(raw)
}

export type TrustBarStat = {
  id: string
  value: string
  label: string
  /** Headline metric — larger visual weight. */
  prominent?: boolean
}

/**
 * Format live platform stats for the landing trust bar.
 * Floors DOWN to clean thresholds; returns null if nothing credible to show.
 */
export function formatTrustBarStats(stats: PlatformStats): TrustBarStat[] | null {
  const predictions = floorToNearest(stats.total_predictions, 1000)
  const users = floorToNearest(stats.total_users, 100)
  const pools = floorToNearest(stats.total_pools, 100)
  const competitions = floorToNearest(stats.total_events, 1)

  // Hide the bar if the headline metric isn't ready yet.
  if (predictions <= 0) return null

  const items: TrustBarStat[] = [
    {
      id: 'predictions',
      value: formatCountWithPlus(predictions),
      label: 'predictions made',
      prominent: true,
    },
  ]

  if (users > 0) {
    items.push({
      id: 'users',
      value: formatCountWithPlus(users),
      label: 'predictors',
    })
  }

  if (pools > 0) {
    items.push({
      id: 'pools',
      value: formatCountWithPlus(pools),
      label: 'pools created',
    })
  }

  // Breadth: live competition count + a fixed football-leagues label.
  if (competitions > 0) {
    items.push({
      id: 'competitions',
      value: formatCountWithPlus(competitions),
      label: 'leagues & cups',
    })
  } else {
    items.push({
      id: 'leagues',
      value: 'Big 5+',
      label: 'CL · MLS · more',
    })
  }

  return items
}
