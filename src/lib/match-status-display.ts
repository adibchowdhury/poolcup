import { normalizeSportKey } from '@/src/lib/sport-display'

/**
 * Shared live status shorts for dashboard / matches tab / featured queries.
 * Unions soccer (API-Football) and baseball (api-sports baseball) live codes.
 */
export const FEATURED_LIVE_STATUS_SHORTS = [
  // Soccer
  '1H',
  'HT',
  '2H',
  'ET',
  'BT',
  'P',
  'LIVE',
  // Baseball innings + live
  'IN0',
  'IN1',
  'IN2',
  'IN3',
  'IN4',
  'IN5',
  'IN6',
  'IN7',
  'IN8',
  'IN9',
] as const

export type FeaturedLiveStatusShort =
  (typeof FEATURED_LIVE_STATUS_SHORTS)[number]

const LIVE_STATUS_SET = new Set<string>(FEATURED_LIVE_STATUS_SHORTS)

export function isFeaturedLiveStatus(
  statusShort: string | null | undefined,
): boolean {
  return LIVE_STATUS_SET.has((statusShort ?? '').trim().toUpperCase())
}

function isBaseballSport(sport: string | null | undefined): boolean {
  if (!sport) return false
  return normalizeSportKey(sport) === 'baseball'
}

/** Infer baseball from inning status codes when sport is unknown. */
function looksLikeBaseballStatus(status: string): boolean {
  return /^IN[0-9]$/.test(status)
}

/**
 * Lock / reveal copy: "Kickoff" (soccer), "First pitch" (baseball), else "Start".
 */
export function matchStartLabel(sport: string | null | undefined): string {
  if (isBaseballSport(sport)) return 'First pitch'
  const key = sport ? normalizeSportKey(sport) : ''
  if (key === 'football' || key === 'soccer' || !sport) return 'Kickoff'
  return 'Start'
}

/** Lowercase phrase for mid-sentence use: "until kickoff" / "until first pitch". */
export function matchStartLabelLower(sport: string | null | undefined): string {
  return matchStartLabel(sport).toLowerCase()
}

/** Final-state chip: "Full time" (soccer), "Final" (baseball). */
export function matchFinalLabel(sport: string | null | undefined): string {
  return isBaseballSport(sport) ? 'Final' : 'Full time'
}

function formatBaseballInningLabel(status: string): string {
  if (status === 'IN0') return 'Extra innings'
  const n = Number.parseInt(status.slice(2), 10)
  if (!Number.isFinite(n) || n < 1) return 'Live'
  if (n === 1) return '1st inning'
  if (n === 2) return '2nd inning'
  if (n === 3) return '3rd inning'
  return `${n}th inning`
}

/**
 * Live / final status chip text. Soccer keeps existing wording; baseball uses
 * Final / inning labels / Live (no soccer minute clock).
 */
export function formatMatchStatusLabel(
  statusShort: string | null | undefined,
  elapsedMinute: number | null | undefined,
  isFinal: boolean,
  sport?: string | null,
): string {
  const status = (statusShort ?? '').trim().toUpperCase()
  const baseball =
    isBaseballSport(sport) || looksLikeBaseballStatus(status)

  if (status === 'PST') return 'Postponed — no result'
  if (status === 'CANC') return 'Cancelled — no points'
  if (status === 'ABD') return 'Abandoned — voided'
  if (status === 'AWD') return 'Awarded — no points'
  if (status === 'WO') return 'Walkover — no points'

  if (isFinal || status === 'FT' || status === 'AET' || status === 'PEN') {
    return baseball ? 'Final' : 'Full time'
  }

  if (baseball) {
    if (looksLikeBaseballStatus(status)) return formatBaseballInningLabel(status)
    if (status === 'LIVE' || status === 'BT') return 'Live'
    if (status === 'NS') return 'Upcoming'
    return status || 'Live'
  }

  if (status === 'HT') return 'Halftime'
  if (status === '1H' || status === '2H') {
    return elapsedMinute != null ? `${elapsedMinute}'` : status
  }
  if (status === 'NS') return 'Upcoming'
  if (elapsedMinute != null) return `${elapsedMinute}'`
  if (status === 'LIVE') return 'Live'
  return status || ''
}
