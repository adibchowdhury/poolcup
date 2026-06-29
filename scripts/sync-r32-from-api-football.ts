/**
 * @deprecated Use `npm run sync:knockout-fixture-ids -- --round=r32` instead.
 * That script resolves fixture_id by teams + kickoff date (not kickoff instant only).
 */
import * as dotenv from 'dotenv'
import path from 'path'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { mapLeagueRoundToGroup } from '@/src/lib/world-cup-groups'
import { resolveTeamFlag } from '@/src/lib/team-flags'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const API_URL =
  'https://v3.football.api-sports.io/fixtures?league=1&season=2026'

type ApiFixture = {
  fixture: {
    id: number
    date: string
    status: { short: string | null; long?: string | null }
  }
  league: { round: string }
  teams: {
    home: { name: string }
    away: { name: string }
  }
}

type ApiFootballResponse = {
  response: ApiFixture[]
  errors?: Record<string, string>
}

type SeededR32Row = {
  id: string
  fixture_id: string | null
  kickoff_at: string
  locked_at: string
  team1_name: string
  team2_name: string
  team1_flag: string | null
  team2_flag: string | null
  status_short: string | null
  round: string
}

function kickoffInstantKey(iso: string): string {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid kickoff timestamp: ${iso}`)
  }
  return new Date(ms).toISOString()
}

function isRealCountryName(name: string | null | undefined): boolean {
  if (name == null) return false
  const value = name.trim()
  if (!value) return false
  if (/^tbd$/i.test(value) || /^to be determined$/i.test(value)) return false
  if (/^winner\b/i.test(value) || /^runner[- ]?up\b/i.test(value)) return false
  if (/^best 3rd\b/i.test(value) || /^3rd\b/i.test(value)) return false
  if (/^[12][A-L]$/i.test(value)) return false
  return true
}

/** Same storage pattern as group-stage rows: emoji when known, else empty string. */
function resolveDbTeamFlag(teamName: string): string {
  const resolved = resolveTeamFlag(teamName, null)
  return resolved.kind === 'emoji' ? resolved.value : ''
}

async function fetchApiFixtures(apiKey: string): Promise<ApiFixture[]> {
  const res = await fetch(API_URL, {
    headers: { 'x-apisports-key': apiKey },
  })

  const raw = (await res.json()) as ApiFootballResponse

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

function buildKickoffIndex(rows: SeededR32Row[]): Map<string, SeededR32Row[]> {
  const index = new Map<string, SeededR32Row[]>()

  for (const row of rows) {
    const key = kickoffInstantKey(row.kickoff_at)
    const bucket = index.get(key) ?? []
    bucket.push(row)
    index.set(key, bucket)
  }

  return index
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  }

  const supabase = createAdminSupabaseClient()

  const { data: seededRows, error: seededError } = await supabase
    .from('matches')
    .select(
      'id, fixture_id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, status_short, round',
    )
    .eq('round', 'r32')
    .order('kickoff_at', { ascending: true })

  if (seededError) {
    throw new Error(`Failed to load seeded r32 rows: ${seededError.message}`)
  }

  const r32Seeded = (seededRows ?? []) as SeededR32Row[]
  const kickoffIndex = buildKickoffIndex(r32Seeded)

  const fixtures = await fetchApiFixtures(apiKey)
  const apiR32 = fixtures.filter(
    (fixture) => mapLeagueRoundToGroup(fixture.league.round).round === 'r32',
  )

  const summary = {
    dry_run: dryRun,
    seeded_r32_rows: r32Seeded.length,
    api_r32_fixtures: apiR32.length,
    updated: [] as Array<Record<string, unknown>>,
    skipped_already_synced: [] as Array<Record<string, unknown>>,
    skipped_unresolved_teams: [] as Array<Record<string, unknown>>,
    skipped_kickoff_mismatch: [] as Array<Record<string, unknown>>,
  }

  for (const fixture of apiR32) {
    const home = fixture.teams.home.name
    const away = fixture.teams.away.name
    const apiFixtureId = String(fixture.fixture.id)
    const kickoffAt = fixture.fixture.date
    const lockedAt = fixture.fixture.date
    const statusShort = fixture.fixture.status?.short ?? 'NS'
    const kickoffKey = kickoffInstantKey(kickoffAt)

    if (!isRealCountryName(home) || !isRealCountryName(away)) {
      summary.skipped_unresolved_teams.push({
        api_fixture_id: apiFixtureId,
        kickoff_at: kickoffAt,
        team1_name: home,
        team2_name: away,
        reason: 'one or both teams are not real countries',
      })
      continue
    }

    const matches = kickoffIndex.get(kickoffKey) ?? []

    if (matches.length === 0) {
      summary.skipped_kickoff_mismatch.push({
        api_fixture_id: apiFixtureId,
        kickoff_at: kickoffAt,
        kickoff_key: kickoffKey,
        team1_name: home,
        team2_name: away,
        reason: 'no seeded r32 row with this kickoff_at',
      })
      continue
    }

    if (matches.length > 1) {
      summary.skipped_kickoff_mismatch.push({
        api_fixture_id: apiFixtureId,
        kickoff_at: kickoffAt,
        kickoff_key: kickoffKey,
        team1_name: home,
        team2_name: away,
        reason: `multiple seeded r32 rows share kickoff_at (${matches.length})`,
        match_ids: matches.map((row) => row.id),
      })
      continue
    }

    const row = matches[0]!
    const nextTeam1Flag = resolveDbTeamFlag(home)
    const nextTeam2Flag = resolveDbTeamFlag(away)

    const alreadySynced =
      row.fixture_id === apiFixtureId &&
      row.team1_name === home &&
      row.team2_name === away &&
      row.team1_flag === nextTeam1Flag &&
      row.team2_flag === nextTeam2Flag &&
      row.status_short === statusShort &&
      kickoffInstantKey(row.kickoff_at) === kickoffKey &&
      kickoffInstantKey(row.locked_at) === kickoffKey

    if (alreadySynced) {
      summary.skipped_already_synced.push({
        match_id: row.id,
        api_fixture_id: apiFixtureId,
        kickoff_at: kickoffAt,
        team1_name: home,
        team2_name: away,
      })
      continue
    }

    const updatePayload = {
      fixture_id: apiFixtureId,
      team1_name: home,
      team2_name: away,
      team1_flag: nextTeam1Flag,
      team2_flag: nextTeam2Flag,
      kickoff_at: kickoffAt,
      locked_at: lockedAt,
      status_short: statusShort,
    }

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', row.id)
        .eq('round', 'r32')

      if (updateError) {
        throw new Error(
          `Failed to update match ${row.id} (api ${apiFixtureId}): ${updateError.message}`,
        )
      }
    }

    summary.updated.push({
      match_id: row.id,
      previous_fixture_id: row.fixture_id,
      api_fixture_id: apiFixtureId,
      previous_team1_name: row.team1_name,
      previous_team2_name: row.team2_name,
      kickoff_at: kickoffAt,
      team1_name: home,
      team2_name: away,
      team1_flag: nextTeam1Flag,
      team2_flag: nextTeam2Flag,
      status_short: statusShort,
    })
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
