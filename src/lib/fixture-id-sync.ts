import { areSameTeamName } from '@/src/lib/team-flags'
import { isValidApiFootballFixtureId } from '@/src/lib/match-updater-guards'
import { isKnockoutRound } from '@/src/lib/classic-round-tab-logic'
import { mapLeagueRoundToGroup } from '@/src/lib/world-cup-groups'

export const WC_2026_SEASON_FIXTURES_URL =
  'https://v3.football.api-sports.io/fixtures?league=1&season=2026'

export type DbMatchForFixtureSync = {
  id: string
  fixture_id: string | null
  round: string
  kickoff_at: string
  locked_at?: string | null
  team1_name: string
  team2_name: string
}

export type ApiFixtureForSync = {
  fixture: { id: number; date: string }
  league: { round: string }
  teams: {
    home: { name: string }
    away: { name: string }
  }
}

export type FixtureIdResolveOutcome =
  | { status: 'already_synced'; fixtureId: string; kickoffAt: string }
  | { status: 'resolved'; fixtureId: string; kickoffAt: string }
  | { status: 'skipped'; reason: string }

/** DB team1/team2 may be home/away in either order vs API. */
export function teamsMatchUnorderedForFixtureSync(
  dbTeam1: string,
  dbTeam2: string,
  apiHome: string,
  apiAway: string,
): boolean {
  return (
    (areSameTeamName(dbTeam1, apiHome) && areSameTeamName(dbTeam2, apiAway)) ||
    (areSameTeamName(dbTeam1, apiAway) && areSameTeamName(dbTeam2, apiHome))
  )
}

function kickoffTimesEqual(a: string, b: string): boolean {
  const aMs = new Date(a).getTime()
  const bMs = new Date(b).getTime()
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return false
  return aMs === bMs
}

export function kickoffUtcDateKey(iso: string): string | null {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString().slice(0, 10)
}

/** True when both sides are known countries (not TBD / bracket placeholders). */
export function isResolvableTeamName(name: string | null | undefined): boolean {
  if (name == null) return false
  const value = name.trim()
  if (!value) return false
  if (/^tbd$/i.test(value) || /^to be determined$/i.test(value)) return false
  if (/^winner\b/i.test(value) || /^runner[- ]?up\b/i.test(value)) return false
  if (/^best 3rd\b/i.test(value) || /^3rd\b/i.test(value)) return false
  if (/^[12][A-L]$/i.test(value)) return false
  return true
}

export function isKnockoutApiFixture(fixture: ApiFixtureForSync): boolean {
  const { round } = mapLeagueRoundToGroup(fixture.league.round)
  return isKnockoutRound(round)
}

export function apiFixtureRound(fixture: ApiFixtureForSync): string {
  return mapLeagueRoundToGroup(fixture.league.round).round
}

function apiFixtureMatchesDbRow(
  fixture: ApiFixtureForSync,
  row: DbMatchForFixtureSync,
): boolean {
  if (apiFixtureRound(fixture) !== row.round) return false

  const home = fixture.teams.home.name
  const away = fixture.teams.away.name
  if (!isResolvableTeamName(home) || !isResolvableTeamName(away)) {
    return false
  }

  return teamsMatchUnorderedForFixtureSync(
    row.team1_name,
    row.team2_name,
    home,
    away,
  )
}

export function resolveKnockoutFixtureIdForRow(
  row: DbMatchForFixtureSync,
  apiFixtures: ApiFixtureForSync[],
  fixtureIdOwnerByFixtureId: ReadonlyMap<string, string>,
): FixtureIdResolveOutcome {
  if (!isKnockoutRound(row.round)) {
    return { status: 'skipped', reason: 'not a knockout round' }
  }

  if (
    !isResolvableTeamName(row.team1_name) ||
    !isResolvableTeamName(row.team2_name)
  ) {
    return { status: 'skipped', reason: 'unresolved team names on DB row' }
  }

  const candidates = apiFixtures.filter((fixture) =>
    apiFixtureMatchesDbRow(fixture, row),
  )

  if (candidates.length === 0) {
    return {
      status: 'skipped',
      reason: 'no API fixture matches round + team pair',
    }
  }

  if (candidates.length > 1) {
    return {
      status: 'skipped',
      reason: `ambiguous: ${candidates.length} API fixtures match`,
    }
  }

  const matched = candidates[0]!
  const fixtureId = String(matched.fixture.id)
  if (!isValidApiFootballFixtureId(fixtureId)) {
    return { status: 'skipped', reason: 'resolved API id failed validation' }
  }

  const ownerId = fixtureIdOwnerByFixtureId.get(fixtureId)
  if (ownerId != null && ownerId !== row.id) {
    return {
      status: 'skipped',
      reason: `fixture_id ${fixtureId} already assigned to another match`,
    }
  }

  const kickoffAt = matched.fixture.date
  if (!kickoffAt || Number.isNaN(new Date(kickoffAt).getTime())) {
    return { status: 'skipped', reason: 'API fixture has invalid kickoff date' }
  }

  const rowFixtureId = row.fixture_id?.trim() ?? ''
  const fixtureIdMatches =
    isValidApiFootballFixtureId(rowFixtureId) && rowFixtureId === fixtureId
  if (fixtureIdMatches && kickoffTimesEqual(row.kickoff_at, kickoffAt)) {
    return { status: 'already_synced', fixtureId, kickoffAt }
  }

  return { status: 'resolved', fixtureId, kickoffAt }
}

export async function fetchWc2026SeasonFixtures(
  apiKey: string,
): Promise<ApiFixtureForSync[]> {
  const res = await fetch(WC_2026_SEASON_FIXTURES_URL, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  })

  const raw = (await res.json()) as {
    response?: ApiFixtureForSync[]
    errors?: Record<string, string>
  }

  if (!res.ok) {
    throw new Error(
      `API-Football request failed: ${res.status} ${res.statusText}`,
    )
  }

  if (raw.errors && Object.keys(raw.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(raw.errors)}`)
  }

  return raw.response ?? []
}

export function buildFixtureIdOwnerMap(
  rows: Array<{ id: string; fixture_id: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>()

  for (const row of rows) {
    if (!isValidApiFootballFixtureId(row.fixture_id)) continue
    map.set(row.fixture_id!.trim(), row.id)
  }

  return map
}

export type KnockoutFixtureIdSyncSummary = {
  dry_run: boolean
  round_filter: string | null
  knockout_rows: number
  api_knockout_fixtures: number
  already_synced: Array<Record<string, unknown>>
  updated: Array<Record<string, unknown>>
  skipped: Array<Record<string, unknown>>
}

/** Patch fixture_id / kickoff / locked_at on existing knockout rows from API season fixtures. */
export async function syncKnockoutFixtureIdsCore(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  apiKey: string,
  options: {
    dryRun: boolean
    roundFilter?: string | null
    rows?: DbMatchForFixtureSync[]
    apiFixtures?: ApiFixtureForSync[]
  } = { dryRun: false },
): Promise<KnockoutFixtureIdSyncSummary> {
  const roundFilter = options.roundFilter ?? null

  let rows = options.rows
  if (!rows) {
    let query = supabase
      .from('matches')
      .select(
        'id, fixture_id, round, kickoff_at, locked_at, team1_name, team2_name',
      )
      .in('round', ['r32', 'r16', 'qf', 'sf', 'final'])
      .order('kickoff_at', { ascending: true })

    if (roundFilter) {
      query = query.eq('round', roundFilter)
    }

    const { data: knockoutRows, error: loadError } = await query
    if (loadError) {
      throw new Error(`Failed to load knockout matches: ${loadError.message}`)
    }
    rows = (knockoutRows ?? []) as DbMatchForFixtureSync[]
  }

  const knockoutApiFixtures =
    options.apiFixtures ??
    (await fetchWc2026SeasonFixtures(apiKey)).filter(isKnockoutApiFixture)

  const fixtureIdOwnerByFixtureId = buildFixtureIdOwnerMap(rows)

  const summary: KnockoutFixtureIdSyncSummary = {
    dry_run: options.dryRun,
    round_filter: roundFilter,
    knockout_rows: rows.length,
    api_knockout_fixtures: knockoutApiFixtures.length,
    already_synced: [],
    updated: [],
    skipped: [],
  }

  for (const row of rows) {
    const outcome = resolveKnockoutFixtureIdForRow(
      row,
      knockoutApiFixtures,
      fixtureIdOwnerByFixtureId,
    )

    if (outcome.status === 'already_synced') {
      summary.already_synced.push({
        match_id: row.id,
        round: row.round,
        fixture_id: outcome.fixtureId,
        team1_name: row.team1_name,
        team2_name: row.team2_name,
        kickoff_at: row.kickoff_at,
        locked_at: row.locked_at,
      })
      continue
    }

    if (outcome.status === 'skipped') {
      summary.skipped.push({
        match_id: row.id,
        round: row.round,
        fixture_id: row.fixture_id,
        team1_name: row.team1_name,
        team2_name: row.team2_name,
        kickoff_at: row.kickoff_at,
        locked_at: row.locked_at,
        reason: outcome.reason,
      })
      continue
    }

    if (!options.dryRun) {
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          fixture_id: outcome.fixtureId,
          kickoff_at: outcome.kickoffAt,
          locked_at: outcome.kickoffAt,
        })
        .eq('id', row.id)

      if (updateError) {
        throw new Error(
          `Failed to update match ${row.id} with fixture_id ${outcome.fixtureId}: ${updateError.message}`,
        )
      }
    }

    fixtureIdOwnerByFixtureId.set(outcome.fixtureId, row.id)

    summary.updated.push({
      match_id: row.id,
      round: row.round,
      previous_fixture_id: row.fixture_id,
      fixture_id: outcome.fixtureId,
      previous_kickoff_at: row.kickoff_at,
      kickoff_at: outcome.kickoffAt,
      previous_locked_at: row.locked_at,
      locked_at: outcome.kickoffAt,
      team1_name: row.team1_name,
      team2_name: row.team2_name,
    })
  }

  return summary
}
