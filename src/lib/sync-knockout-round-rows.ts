import type { SupabaseClient } from '@supabase/supabase-js'
import type { KnockoutRoundId } from '@/src/lib/classic-round-tab-logic'
import {
  apiFixtureRound,
  fetchWc2026SeasonFixtures,
  isKnockoutApiFixture,
  isResolvableTeamName,
  syncKnockoutFixtureIdsCore,
  teamsMatchUnorderedForFixtureSync,
  type ApiFixtureForSync,
  type DbMatchForFixtureSync,
} from '@/src/lib/fixture-id-sync'
import { isValidApiFootballFixtureId } from '@/src/lib/match-updater-guards'
import { areSameTeamName, resolveTeamFlag } from '@/src/lib/team-flags'

/** Rounds this job may create (safety net includes r16). */
export const KNOCKOUT_ROUND_CREATE_ORDER = [
  'r16',
  'qf',
  'sf',
  'final',
] as const satisfies readonly KnockoutRoundId[]

export type KnockoutRoundCreateTarget =
  (typeof KNOCKOUT_ROUND_CREATE_ORDER)[number]

const PRIOR_ROUND: Record<KnockoutRoundCreateTarget, KnockoutRoundId> = {
  r16: 'r32',
  qf: 'r16',
  sf: 'qf',
  final: 'sf',
}

/** FIFA WC 2026 match_number slots per round (103 = 3rd-place, not created here). */
export const FIFA_MATCH_NUMBER_RANGES: Record<
  KnockoutRoundCreateTarget,
  readonly [number, number]
> = {
  r16: [89, 96],
  qf: [97, 100],
  sf: [101, 102],
  final: [104, 104],
}

const EXPECTED_SLOT_COUNT: Record<KnockoutRoundCreateTarget, number> = {
  r16: 8,
  qf: 4,
  sf: 2,
  final: 1,
}

type DbMatchRow = {
  id: string
  fixture_id: string | null
  round: string
  match_number: number | null
  kickoff_at: string
  locked_at: string
  team1_name: string
  team2_name: string
  is_final: boolean | null
  advancing_team: number | null
}

type PriorRoundMatchRow = Pick<
  DbMatchRow,
  'round' | 'team1_name' | 'team2_name' | 'is_final' | 'advancing_team'
>

export type KnockoutRoundRowWouldCreate = {
  round: KnockoutRoundCreateTarget
  fixture_id: string
  match_number: number
  kickoff_at: string
  team1_name: string
  team2_name: string
}

export type KnockoutRoundRowSkipped = {
  round: KnockoutRoundCreateTarget
  fixture_id: string | null
  api_home: string | null
  api_away: string | null
  reason: string
}

export type KnockoutRoundSyncRoundResult = {
  round: KnockoutRoundCreateTarget
  prior_round: KnockoutRoundId
  skipped_early: string | null
  advancer_count: number
  api_fixtures_in_round: number
  would_create: KnockoutRoundRowWouldCreate[]
  created: KnockoutRoundRowWouldCreate[]
  skipped: KnockoutRoundRowSkipped[]
}

export type SyncKnockoutRoundRowsResult = {
  dry_run: boolean
  round_filter: KnockoutRoundCreateTarget | null
  skipped_api_fetch: boolean
  rounds: KnockoutRoundSyncRoundResult[]
  needs_attention: string[]
  fixture_id_sync: Awaited<ReturnType<typeof syncKnockoutFixtureIdsCore>> | null
}

export type SyncKnockoutRoundRowsOptions = {
  dryRun: boolean
  roundFilter?: KnockoutRoundCreateTarget | null
  apiKey: string
  supabase: SupabaseClient
}

function resolveDbTeamFlag(teamName: string): string {
  const resolved = resolveTeamFlag(teamName, null)
  return resolved.kind === 'emoji' ? resolved.value : ''
}

function advancerNameFromRow(row: PriorRoundMatchRow): string | null {
  if (!row.is_final) return null
  if (row.advancing_team !== 1 && row.advancing_team !== 2) return null
  const name =
    row.advancing_team === 1 ? row.team1_name.trim() : row.team2_name.trim()
  return isResolvableTeamName(name) ? name : null
}

function buildAdvancerNames(
  priorRows: PriorRoundMatchRow[],
  priorRound: KnockoutRoundId,
): string[] {
  const names: string[] = []
  for (const row of priorRows) {
    if (row.round !== priorRound) continue
    const name = advancerNameFromRow(row)
    if (name) names.push(name)
  }
  return names
}

function roundRowHasValidFixture(row: DbMatchRow): boolean {
  return isValidApiFootballFixtureId(row.fixture_id)
}

function isRoundComplete(
  round: KnockoutRoundCreateTarget,
  roundRows: DbMatchRow[],
): boolean {
  const withValidFixture = roundRows.filter(roundRowHasValidFixture)
  return withValidFixture.length >= EXPECTED_SLOT_COUNT[round]
}

function existingTeamPairInRound(
  roundRows: DbMatchRow[],
  home: string,
  away: string,
): boolean {
  return roundRows.some((row) =>
    teamsMatchUnorderedForFixtureSync(row.team1_name, row.team2_name, home, away),
  )
}

function existingFixtureId(
  allRows: DbMatchRow[],
  fixtureId: string,
): boolean {
  return allRows.some(
    (row) =>
      row.fixture_id != null &&
      row.fixture_id.trim() === fixtureId,
  )
}

function reconcileFixtureTeamsToAdvancers(
  home: string,
  away: string,
  advancerNames: string[],
): { ok: true } | { ok: false; reason: string } {
  if (!isResolvableTeamName(home) || !isResolvableTeamName(away)) {
    return { ok: false, reason: 'API fixture has unresolved team name(s)' }
  }

  if (areSameTeamName(home, away)) {
    return { ok: false, reason: 'API fixture has identical home/away teams' }
  }

  const homeMatches = advancerNames.filter((name) => areSameTeamName(name, home))
  const awayMatches = advancerNames.filter((name) => areSameTeamName(name, away))

  if (homeMatches.length === 0) {
    return {
      ok: false,
      reason: `home team "${home}" not in prior-round advancer set`,
    }
  }

  if (awayMatches.length === 0) {
    return {
      ok: false,
      reason: `away team "${away}" not in prior-round advancer set`,
    }
  }

  const homeAdvancer = homeMatches[0]!
  const awayAdvancer = awayMatches.find(
    (name) => !areSameTeamName(name, homeAdvancer),
  )

  if (!awayAdvancer) {
    return {
      ok: false,
      reason: 'both API teams map to the same advancer',
    }
  }

  return { ok: true }
}

function nextMatchNumberForRound(
  round: KnockoutRoundCreateTarget,
  roundRows: DbMatchRow[],
  allRows: DbMatchRow[],
  reservedNumbers: ReadonlySet<number> = new Set(),
): number | null {
  const usedInRound = new Set(
    roundRows
      .map((row) => row.match_number)
      .filter((n): n is number => n != null && Number.isFinite(n)),
  )
  const usedGlobally = new Set(
    allRows
      .map((row) => row.match_number)
      .filter((n): n is number => n != null && Number.isFinite(n)),
  )

  for (const n of reservedNumbers) {
    usedInRound.add(n)
    usedGlobally.add(n)
  }

  const [rangeMin, rangeMax] = FIFA_MATCH_NUMBER_RANGES[round]
  for (let candidate = rangeMin; candidate <= rangeMax; candidate += 1) {
    if (!usedInRound.has(candidate) && !usedGlobally.has(candidate)) {
      return candidate
    }
  }

  let maxGlobal = 0
  for (const n of usedGlobally) {
    if (n > maxGlobal) maxGlobal = n
  }
  const fallback = maxGlobal + 1
  if (usedGlobally.has(fallback)) {
    return null
  }
  return fallback
}

function validateKickoff(kickoffAt: string | null | undefined): string | null {
  if (kickoffAt == null || kickoffAt.trim() === '') return null
  const ms = new Date(kickoffAt).getTime()
  if (Number.isNaN(ms)) return null
  return kickoffAt
}

export async function syncKnockoutRoundRows(
  options: SyncKnockoutRoundRowsOptions,
): Promise<SyncKnockoutRoundRowsResult> {
  const { dryRun, roundFilter, apiKey, supabase } = options

  const roundsToProcess = roundFilter
    ? KNOCKOUT_ROUND_CREATE_ORDER.filter((round) => round === roundFilter)
    : [...KNOCKOUT_ROUND_CREATE_ORDER]

  if (roundsToProcess.length === 0) {
    throw new Error(`Invalid round filter: ${roundFilter ?? 'none'}`)
  }

  const { data: allKnockoutRows, error: loadError } = await supabase
    .from('matches')
    .select(
      'id, fixture_id, round, match_number, kickoff_at, locked_at, team1_name, team2_name, is_final, advancing_team',
    )
    .in('round', ['r32', ...KNOCKOUT_ROUND_CREATE_ORDER])

  if (loadError) {
    throw new Error(`Failed to load matches: ${loadError.message}`)
  }

  const allRows = (allKnockoutRows ?? []) as DbMatchRow[]
  const needsAttention: string[] = []
  const roundResults: KnockoutRoundSyncRoundResult[] = []
  const createdAll: KnockoutRoundRowWouldCreate[] = []

  const roundPlans: Array<{
    round: KnockoutRoundCreateTarget
    priorRound: KnockoutRoundId
    roundRows: DbMatchRow[]
    advancerNames: string[]
    skippedEarly: string | null
  }> = []

  for (const round of roundsToProcess) {
    const priorRound = PRIOR_ROUND[round]
    const roundRows = allRows.filter((row) => row.round === round)
    const advancerNames = buildAdvancerNames(allRows, priorRound)

    let skippedEarly: string | null = null
    if (isRoundComplete(round, roundRows)) {
      skippedEarly = `round ${round} already has ${EXPECTED_SLOT_COUNT[round]} row(s) with valid fixture_id`
    } else if (advancerNames.length === 0) {
      skippedEarly = `no finalized advancers from prior round ${priorRound}`
    }

    roundPlans.push({
      round,
      priorRound,
      roundRows,
      advancerNames,
      skippedEarly,
    })
  }

  const needsApiFetch = roundPlans.some((plan) => plan.skippedEarly == null)
  let knockoutApiFixtures: ApiFixtureForSync[] = []

  if (needsApiFetch) {
    try {
      knockoutApiFixtures = (await fetchWc2026SeasonFixtures(apiKey)).filter(
        isKnockoutApiFixture,
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'API-Football fetch failed'
      needsAttention.push(`API fetch failed: ${message}`)
      throw error
    }
  }

  for (const plan of roundPlans) {
    const result: KnockoutRoundSyncRoundResult = {
      round: plan.round,
      prior_round: plan.priorRound,
      skipped_early: plan.skippedEarly,
      advancer_count: plan.advancerNames.length,
      api_fixtures_in_round: 0,
      would_create: [],
      created: [],
      skipped: [],
    }

    if (plan.skippedEarly) {
      roundResults.push(result)
      continue
    }

    const apiFixturesForRound = knockoutApiFixtures.filter(
      (fixture) => apiFixtureRound(fixture) === plan.round,
    )
    result.api_fixtures_in_round = apiFixturesForRound.length

    const reservedMatchNumbers = new Set<number>()

    for (const fixture of apiFixturesForRound) {
      const home = fixture.teams.home.name
      const away = fixture.teams.away.name
      const fixtureId = String(fixture.fixture.id)

      if (!isValidApiFootballFixtureId(fixtureId)) {
        result.skipped.push({
          round: plan.round,
          fixture_id: fixtureId,
          api_home: home,
          api_away: away,
          reason: 'invalid or placeholder fixture_id from API',
        })
        needsAttention.push(
          `${plan.round}: skipped fixture ${fixtureId} (${home} vs ${away}) — invalid fixture_id`,
        )
        continue
      }

      if (existingFixtureId(allRows, fixtureId)) {
        result.skipped.push({
          round: plan.round,
          fixture_id: fixtureId,
          api_home: home,
          api_away: away,
          reason: 'fixture_id already exists on a matches row',
        })
        continue
      }

      if (existingTeamPairInRound(plan.roundRows, home, away)) {
        result.skipped.push({
          round: plan.round,
          fixture_id: fixtureId,
          api_home: home,
          api_away: away,
          reason: 'team pair already exists in this round',
        })
        continue
      }

      const reconcile = reconcileFixtureTeamsToAdvancers(
        home,
        away,
        plan.advancerNames,
      )
      if (!reconcile.ok) {
        result.skipped.push({
          round: plan.round,
          fixture_id: fixtureId,
          api_home: home,
          api_away: away,
          reason: reconcile.reason,
        })
        needsAttention.push(
          `${plan.round}: needs attention — ${home} vs ${away} (fixture ${fixtureId}): ${reconcile.reason}`,
        )
        continue
      }

      const kickoffAt = validateKickoff(fixture.fixture.date)
      if (!kickoffAt) {
        result.skipped.push({
          round: plan.round,
          fixture_id: fixtureId,
          api_home: home,
          api_away: away,
          reason: 'API fixture has invalid kickoff date',
        })
        needsAttention.push(
          `${plan.round}: fixture ${fixtureId} has invalid kickoff`,
        )
        continue
      }

      const matchNumber = nextMatchNumberForRound(
        plan.round,
        plan.roundRows,
        allRows,
        reservedMatchNumbers,
      )
      if (matchNumber == null) {
        result.skipped.push({
          round: plan.round,
          fixture_id: fixtureId,
          api_home: home,
          api_away: away,
          reason: 'no available match_number',
        })
        needsAttention.push(
          `${plan.round}: no match_number for ${home} vs ${away} (fixture ${fixtureId})`,
        )
        continue
      }

      const wouldCreate: KnockoutRoundRowWouldCreate = {
        round: plan.round,
        fixture_id: fixtureId,
        match_number: matchNumber,
        kickoff_at: kickoffAt,
        team1_name: home,
        team2_name: away,
      }

      result.would_create.push(wouldCreate)
      reservedMatchNumbers.add(matchNumber)

      if (dryRun) {
        continue
      }

      const insertPayload = {
        fixture_id: fixtureId,
        kickoff_at: kickoffAt,
        locked_at: kickoffAt,
        team1_name: home,
        team2_name: away,
        team1_flag: resolveDbTeamFlag(home),
        team2_flag: resolveDbTeamFlag(away),
        round: plan.round,
        group_name: null,
        status_short: 'NS',
        is_final: false,
        match_number: matchNumber,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('matches')
        .insert(insertPayload)
        .select('id')
        .single()

      if (insertError) {
        result.skipped.push({
          round: plan.round,
          fixture_id: fixtureId,
          api_home: home,
          api_away: away,
          reason: `insert failed: ${insertError.message}`,
        })
        needsAttention.push(
          `${plan.round}: insert failed for ${home} vs ${away}: ${insertError.message}`,
        )
        continue
      }

      const newRow: DbMatchRow = {
        id: inserted.id,
        fixture_id: fixtureId,
        round: plan.round,
        match_number: matchNumber,
        kickoff_at: kickoffAt,
        locked_at: kickoffAt,
        team1_name: home,
        team2_name: away,
        is_final: false,
        advancing_team: null,
      }

      allRows.push(newRow)
      plan.roundRows.push(newRow)
      result.created.push(wouldCreate)
      createdAll.push(wouldCreate)
    }

    roundResults.push(result)
  }

  let fixtureIdSync: SyncKnockoutRoundRowsResult['fixture_id_sync'] = null

  if (!dryRun && createdAll.length > 0) {
    const syncRows = allRows
      .filter((row) =>
        (KNOCKOUT_ROUND_CREATE_ORDER as readonly string[]).includes(row.round),
      )
      .map(
        (row): DbMatchForFixtureSync => ({
          id: row.id,
          fixture_id: row.fixture_id,
          round: row.round,
          kickoff_at: row.kickoff_at,
          locked_at: row.locked_at,
          team1_name: row.team1_name,
          team2_name: row.team2_name,
        }),
      )

    fixtureIdSync = await syncKnockoutFixtureIdsCore(supabase, apiKey, {
      dryRun: false,
      roundFilter: roundFilter ?? null,
      rows: syncRows,
      apiFixtures: knockoutApiFixtures,
    })
  }

  return {
    dry_run: dryRun,
    round_filter: roundFilter ?? null,
    skipped_api_fetch: !needsApiFetch,
    rounds: roundResults,
    needs_attention: needsAttention,
    fixture_id_sync: fixtureIdSync,
  }
}

/** Live DB catalog check (repo schema has no match_number UNIQUE; only fixture_id UNIQUE). */
export const MATCH_NUMBER_CONSTRAINT_NOTE =
  'matches.match_number exists in production (nullable integer). Checked-in schema (01_tables.sql) has no match_number column and no UNIQUE on match_number; only matches_fixture_id_key UNIQUE on fixture_id. Assignment uses FIFA ranges then lowest unused slot per round.'
