import { mapLeagueRoundToGroup } from '@/src/lib/world-cup-groups'
import {
  API_FOOTBALL_MLS_LEAGUE_ID,
  mapMlsApiRoundToCode,
} from '@/src/lib/mls-playoff-rounds'

/** API-Football World Cup league id. */
export const API_FOOTBALL_WORLD_CUP_LEAGUE_ID = 1
/** API-Football Champions League id. */
export const API_FOOTBALL_CHAMPIONS_LEAGUE_ID = 2
export { API_FOOTBALL_MLS_LEAGUE_ID }

const CL_ROUND_CODES = [
  'cl_league',
  'cl_playoff',
  'cl_r16',
  'cl_qf',
  'cl_sf',
  'cl_final',
] as const

export type ClRoundCode = (typeof CL_ROUND_CODES)[number]

export function mapClApiRoundToCode(apiRound: string): ClRoundCode | null {
  const r = apiRound.trim()

  if (/^League Stage/i.test(r)) return 'cl_league'
  if (/^Play-offs$/i.test(r)) return null
  if (/Knockout Round Play-offs/i.test(r) || /^Round of 32$/i.test(r)) {
    return 'cl_playoff'
  }
  if (/Round of 16/i.test(r)) return 'cl_r16'
  if (/Quarter-finals/i.test(r)) return 'cl_qf'
  if (/Semi-finals/i.test(r)) return 'cl_sf'
  if (/^Final$/i.test(r)) return 'cl_final'
  return null
}

export type MappedRound = {
  round: string
  group_name: string | null
  /** When true, skip ingesting this fixture (e.g. CL qualifying). */
  skip: boolean
}

/**
 * Map API-Football league.round → PoolCup matches.round / group_name
 * based on provider league id.
 */
export function mapProviderRound(
  providerLeagueId: number,
  apiRound: string | null | undefined,
): MappedRound {
  const label = (apiRound ?? '').trim()

  if (providerLeagueId === API_FOOTBALL_WORLD_CUP_LEAGUE_ID) {
    const mapped = mapLeagueRoundToGroup(label || 'Group Stage')
    return { round: mapped.round, group_name: mapped.group_name, skip: false }
  }

  if (providerLeagueId === API_FOOTBALL_CHAMPIONS_LEAGUE_ID) {
    const code = mapClApiRoundToCode(label)
    if (!code) return { round: '', group_name: null, skip: true }
    return { round: code, group_name: null, skip: false }
  }

  if (providerLeagueId === API_FOOTBALL_MLS_LEAGUE_ID) {
    const mapped = mapMlsApiRoundToCode(label)
    if (mapped.unmapped) {
      console.warn(
        '[mls-round-map] unmapped MLS league.round, falling back to league',
        { apiRound: label },
      )
    }
    return { round: mapped.round, group_name: null, skip: false }
  }

  return { round: 'league', group_name: null, skip: false }
}
