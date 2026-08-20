/** API-Football MLS league id. */
export const API_FOOTBALL_MLS_LEAGUE_ID = 253

export const MLS_PLAYOFF_ROUND_IDS = [
  'po_wildcard',
  'po_r1',
  'po_conf_sf',
  'po_conf_final',
  'po_final',
] as const

export type MlsPlayoffRoundId = (typeof MLS_PLAYOFF_ROUND_IDS)[number]

/** Bracket order: Wild Card → Round One → Conf Semifinals → Conf Finals → MLS Cup. */
export const MLS_PLAYOFF_ROUND_ORDER = MLS_PLAYOFF_ROUND_IDS

export const MLS_PLAYOFF_ROUND_LABELS: Record<MlsPlayoffRoundId, string> = {
  po_wildcard: 'Wild Card',
  po_r1: 'Round One',
  po_conf_sf: 'Conference Semifinals',
  po_conf_final: 'Conference Finals',
  po_final: 'MLS Cup',
}

/** Season-style rounds that stay on the Season tab (not po_*). */
export const SEASON_FLAT_ROUND_IDS = ['league', 'regular', 'preseason'] as const

export type SeasonFlatRoundId = (typeof SEASON_FLAT_ROUND_IDS)[number]

export function isMlsPlayoffRound(round: string): round is MlsPlayoffRoundId {
  return (MLS_PLAYOFF_ROUND_IDS as readonly string[]).includes(round)
}

export function isSeasonFlatRound(round: string): round is SeasonFlatRoundId {
  return (SEASON_FLAT_ROUND_IDS as readonly string[]).includes(round)
}

export function mlsPlayoffRoundLabel(round: string): string | null {
  if (!isMlsPlayoffRound(round)) return null
  return MLS_PLAYOFF_ROUND_LABELS[round]
}

export function hasMlsPlayoffRounds(items: Array<{ round: string }>): boolean {
  return items.some((item) => isMlsPlayoffRound(item.round))
}

/**
 * Season event that also has MLS playoff-coded matches.
 * Callers must already exclude WC tournament mode.
 */
export function isSeasonPlayoffMixedMatches(
  items: Array<{ round: string }>,
): boolean {
  return items.length > 0 && hasMlsPlayoffRounds(items)
}

function looksLikeMlsRegularSeason(label: string): boolean {
  const r = label.trim().toLowerCase()
  if (!r) return true
  return r.includes('regular')
}

/**
 * Map API-Football MLS `league.round` → PoolCup codes.
 * Playoff strings → po_*; regular / empty / unmapped → 'league'.
 * Never returns WC codes. Never skips a match.
 */
export function mapMlsApiRoundToCode(apiRound: string | null | undefined): {
  round: MlsPlayoffRoundId | 'league'
  unmapped: boolean
} {
  const label = (apiRound ?? '').trim()
  if (looksLikeMlsRegularSeason(label)) {
    return { round: 'league', unmapped: false }
  }

  const r = label.toLowerCase()

  if (r.includes('wild card') || r.includes('wildcard') || r.includes('wild-card')) {
    return { round: 'po_wildcard', unmapped: false }
  }

  if (r.includes('conference') && r.includes('semi')) {
    return { round: 'po_conf_sf', unmapped: false }
  }

  if (r.includes('conference') && r.includes('final')) {
    return { round: 'po_conf_final', unmapped: false }
  }

  if (
    r.includes('round one') ||
    r.includes('first round') ||
    /\bround\s*1\b/.test(r) ||
    /\bround\s+one\b/.test(r)
  ) {
    return { round: 'po_r1', unmapped: false }
  }

  if (r.includes('mls cup') || r.includes('mls-cup')) {
    return { round: 'po_final', unmapped: false }
  }

  if (/\bfinals?\b/.test(r) && !r.includes('conference')) {
    return { round: 'po_final', unmapped: false }
  }

  return { round: 'league', unmapped: true }
}

export type MlsPlayoffStageGroup<T> = {
  round: MlsPlayoffRoundId
  label: string
  matches: T[]
}

export function groupMlsPlayoffMatchesByStage<T extends { round: string }>(
  items: T[],
  getKickoffMs: (item: T) => number,
): MlsPlayoffStageGroup<T>[] {
  const playoffItems = items.filter((item) => isMlsPlayoffRound(item.round))
  const groups: MlsPlayoffStageGroup<T>[] = []

  for (const round of MLS_PLAYOFF_ROUND_ORDER) {
    const matches = playoffItems
      .filter((item) => item.round === round)
      .sort((a, b) => getKickoffMs(a) - getKickoffMs(b))
    if (matches.length === 0) continue
    groups.push({
      round,
      label: MLS_PLAYOFF_ROUND_LABELS[round],
      matches,
    })
  }

  return groups
}
