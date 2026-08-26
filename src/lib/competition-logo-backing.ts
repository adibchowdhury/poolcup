/**
 * Per-league logo chip backing for create-flow competition cards.
 * Keyed by sporting_events.provider_league_id (API-Football league id).
 */
export type CompetitionLogoBacking = {
  /** Perfect circle fill behind the league mark. */
  circleColor: string
  /** Optional hairline on light circles (e.g. white on #171717 cards). */
  circleBorder?: string
  /** CSS filter applied to the logo img (Premier League white mark). */
  logoFilter?: string
}

/** Premier League brand purple. */
export const PREMIER_LEAGUE_PURPLE = '#38003C'

/**
 * api-football provider_league_id → backing treatment.
 * All other leagues: no circle (bare logo).
 */
export const COMPETITION_LOGO_BACKING_BY_LEAGUE_ID: Record<
  string,
  CompetitionLogoBacking
> = {
  /** La Liga */
  '140': {
    circleColor: '#ffffff',
    circleBorder: '1px solid rgba(255, 255, 255, 0.14)',
  },
  /** Ligue 1 */
  '61': {
    circleColor: '#075BF7',
  },
  /** Premier League — white mark on brand purple */
  '39': {
    circleColor: PREMIER_LEAGUE_PURPLE,
    logoFilter: 'brightness(0) invert(1)',
  },
}

export function getCompetitionLogoBacking(
  provider: string | null | undefined,
  providerLeagueId: string | null | undefined,
): CompetitionLogoBacking | null {
  const leagueId = providerLeagueId?.trim()
  if (!leagueId) return null
  // Soccer/backing ids are API-Football football leagues.
  if (provider && provider !== 'api-football') return null
  return COMPETITION_LOGO_BACKING_BY_LEAGUE_ID[leagueId] ?? null
}

/**
 * NFL (api-american-football league 1): CDN logo returns HTTP 200 but the
 * dark shield is invisible on dark card surfaces — prefer sport-ball fallback.
 */
export function shouldPreferSportBallFallback(
  provider: string | null | undefined,
  providerLeagueId: string | null | undefined,
): boolean {
  return (
    provider === 'api-american-football' &&
    providerLeagueId?.trim() === '1'
  )
}
