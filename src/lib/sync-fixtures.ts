import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchLeagueSeasonFixtures,
  isFinalStatus,
  type ApiFootballFixture,
} from '@/src/lib/api-football'
import { mapProviderRound } from '@/src/lib/api-football-round-map'
import { ensureOfficialPoolsBestEffort } from '@/src/lib/ensure-official-pools'
import { isValidApiFootballFixtureId } from '@/src/lib/match-updater-guards'
import { withSyncJob } from '@/src/lib/sync-jobs'

export const API_FOOTBALL_PROVIDER = 'api-football'

/** Pause between league API calls to stay under rate limits. */
const INTER_LEAGUE_DELAY_MS = 1200
const UPSERT_BATCH_SIZE = 40
const LOOKUP_BATCH_SIZE = 100
/** Soft cap fixtures processed per event (API typically returns <400/season). */
const MAX_FIXTURES_PER_EVENT = 500

export type SyncableSportingEvent = {
  id: string
  name: string
  slug: string
  status: string
  provider: string | null
  provider_league_id: string | null
  provider_season: string | null
  event_type: string | null
}

export type EventFixtureSyncResult = {
  eventId: string
  eventName: string
  leagueId: number
  season: number
  fetched: number
  skippedRound: number
  processed: number
  upserted: number
  rawOnlyUpdates: number
  errors: string[]
  status: 'success' | 'error'
}

export type SyncFixturesSummary = {
  eventsConsidered: number
  eventsSynced: number
  eventsFailed: number
  fixturesProcessed: number
  fixturesChanged: number
  officialPoolsCreated: number | null
  results: EventFixtureSyncResult[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function logoOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toUtcIso(dateStr: string): string {
  const ms = Date.parse(dateStr)
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid fixture date: ${dateStr}`)
  }
  return new Date(ms).toISOString()
}

type ExistingMatch = {
  fixture_id: string
  is_final: boolean
}

async function lookupExistingMatches(
  supabase: SupabaseClient,
  fixtureIds: string[],
): Promise<Map<string, ExistingMatch>> {
  const map = new Map<string, ExistingMatch>()
  for (let i = 0; i < fixtureIds.length; i += LOOKUP_BATCH_SIZE) {
    const batch = fixtureIds.slice(i, i + LOOKUP_BATCH_SIZE)
    const { data, error } = await supabase
      .from('matches')
      .select('fixture_id, is_final')
      .in('fixture_id', batch)

    if (error) {
      throw new Error(`Failed looking up fixture_ids: ${error.message}`)
    }
    for (const row of data ?? []) {
      if (!row.fixture_id) continue
      map.set(row.fixture_id, {
        fixture_id: row.fixture_id,
        is_final: Boolean(row.is_final),
      })
    }
  }
  return map
}

function buildMatchRow(
  fixture: ApiFootballFixture,
  eventId: string,
  providerLeagueId: number,
  existing: ExistingMatch | undefined,
): Record<string, unknown> | null {
  const fixtureId = String(fixture.fixture.id)
  if (!isValidApiFootballFixtureId(fixtureId)) return null

  const mapped = mapProviderRound(
    providerLeagueId,
    fixture.league?.round ?? null,
  )
  if (mapped.skip) return null

  const dateRaw = fixture.fixture.date?.trim()
  if (!dateRaw) return null
  const kickoffAt = toUtcIso(dateRaw)
  const statusShort = fixture.fixture.status.short?.trim() || null
  const goalsHome = fixture.goals.home
  const goalsAway = fixture.goals.away
  const isFinal =
    statusShort != null && isFinalStatus(statusShort) && goalsHome != null && goalsAway != null

  const team1Name = fixture.teams.home.name?.trim()
  const team2Name = fixture.teams.away.name?.trim()
  if (!team1Name || !team2Name) return null

  const nowIso = new Date().toISOString()
  const base: Record<string, unknown> = {
    fixture_id: fixtureId,
    event_id: eventId,
    kickoff_at: kickoffAt,
    locked_at: kickoffAt,
    team1_name: team1Name,
    team2_name: team2Name,
    team1_logo: logoOrNull(fixture.teams.home.logo),
    team2_logo: logoOrNull(fixture.teams.away.logo),
    round: mapped.round,
    group_name: mapped.group_name,
    status_short: statusShort,
    elapsed_minute: fixture.fixture.status.elapsed,
    provider_raw: fixture,
    provider_raw_at: nowIso,
  }

  // Never overwrite finals already scored in DB (scoring pipeline owns those).
  if (existing?.is_final) {
    return {
      fixture_id: fixtureId,
      provider_raw: fixture,
      provider_raw_at: nowIso,
    }
  }

  return {
    ...base,
    result_team1: goalsHome,
    result_team2: goalsAway,
    is_final: isFinal,
    advancing_team: null,
    match_number: null,
    team1_flag: null,
    team2_flag: null,
  }
}

async function upsertMatchRows(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<{ ok: number; failed: string[] }> {
  let ok = 0
  const failed: string[] = []

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE)
    const { error } = await supabase.from('matches').upsert(batch, {
      onConflict: 'fixture_id',
      ignoreDuplicates: false,
    })

    if (!error) {
      ok += batch.length
      continue
    }

    for (const row of batch) {
      const { error: rowError } = await supabase.from('matches').upsert(row, {
        onConflict: 'fixture_id',
        ignoreDuplicates: false,
      })
      if (rowError) {
        failed.push(
          `${String(row.fixture_id)}: ${rowError.message}`,
        )
      } else {
        ok += 1
      }
    }
  }

  return { ok, failed }
}

export async function listSyncableApiFootballEvents(
  supabase: SupabaseClient,
  options?: { eventId?: string | null },
): Promise<SyncableSportingEvent[]> {
  let query = supabase
    .from('sporting_events')
    .select(
      'id, name, slug, status, provider, provider_league_id, provider_season, event_type',
    )
    .eq('provider', API_FOOTBALL_PROVIDER)
    .in('status', ['live', 'upcoming'])
    .order('name', { ascending: true })

  if (options?.eventId) {
    query = query.eq('id', options.eventId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to load sporting_events: ${error.message}`)
  }
  return (data ?? []) as SyncableSportingEvent[]
}

async function syncOneEvent(
  supabase: SupabaseClient,
  apiKey: string,
  event: SyncableSportingEvent,
): Promise<EventFixtureSyncResult> {
  const leagueId = Number(event.provider_league_id)
  const season = Number(event.provider_season)
  const base: EventFixtureSyncResult = {
    eventId: event.id,
    eventName: event.name,
    leagueId,
    season,
    fetched: 0,
    skippedRound: 0,
    processed: 0,
    upserted: 0,
    rawOnlyUpdates: 0,
    errors: [],
    status: 'success',
  }

  if (!Number.isFinite(leagueId) || leagueId <= 0) {
    base.status = 'error'
    base.errors.push('Invalid provider_league_id')
    return base
  }
  if (!Number.isFinite(season) || season < 2000) {
    base.status = 'error'
    base.errors.push('Invalid provider_season')
    return base
  }

  return withSyncJob(
    supabase,
    {
      jobType: 'sync_fixtures',
      eventId: event.id,
      detail: { leagueId, season, eventName: event.name },
    },
    async () => {
      const fixtures = await fetchLeagueSeasonFixtures(apiKey, leagueId, season)
      base.fetched = fixtures.length

      const limited = fixtures.slice(0, MAX_FIXTURES_PER_EVENT)
      const fixtureIds = limited.map((f) => String(f.fixture.id))
      const existing = await lookupExistingMatches(supabase, fixtureIds)

      const rows: Record<string, unknown>[] = []
      let skippedRound = 0
      let rawOnly = 0

      for (const fixture of limited) {
        const id = String(fixture.fixture.id)
        const row = buildMatchRow(fixture, event.id, leagueId, existing.get(id))
        if (!row) {
          skippedRound += 1
          continue
        }
        if (existing.get(id)?.is_final) rawOnly += 1
        rows.push(row)
      }

      base.skippedRound = skippedRound
      base.rawOnlyUpdates = rawOnly
      base.processed = rows.length

      const { ok, failed } = await upsertMatchRows(supabase, rows)
      base.upserted = ok
      if (failed.length > 0) {
        base.errors.push(...failed.slice(0, 25))
        base.status = failed.length === rows.length ? 'error' : 'success'
      }

      const syncStatus =
        base.status === 'error'
          ? 'error'
          : failed.length > 0
            ? 'partial'
            : 'success'

      const { error: eventUpdateError } = await supabase
        .from('sporting_events')
        .update({
          last_fixture_sync_at: new Date().toISOString(),
          last_fixture_sync_status: syncStatus,
        })
        .eq('id', event.id)

      if (eventUpdateError) {
        base.errors.push(`event stamp: ${eventUpdateError.message}`)
      }

      if (base.status === 'error') {
        throw new Error(
          base.errors[0] ?? `Fixture sync failed for ${event.name}`,
        )
      }

      return {
        itemsProcessed: base.processed,
        itemsChanged: base.upserted,
        partial: failed.length > 0,
        detail: {
          fetched: base.fetched,
          skippedRound: base.skippedRound,
          rawOnlyUpdates: base.rawOnlyUpdates,
          failed: failed.length,
        },
        result: base,
      }
    },
  ).catch(async (err) => {
    const message = err instanceof Error ? err.message : String(err)
    base.status = 'error'
    if (!base.errors.includes(message)) base.errors.push(message)

    await supabase
      .from('sporting_events')
      .update({
        last_fixture_sync_at: new Date().toISOString(),
        last_fixture_sync_status: 'error',
      })
      .eq('id', event.id)

    return base
  })
}

/**
 * Automated upcoming/reschedule fixture ingestion for all (or one) api-football events.
 */
export async function syncFixturesFromApiFootball(
  supabase: SupabaseClient,
  apiKey: string,
  options?: { eventId?: string | null },
): Promise<SyncFixturesSummary> {
  const events = await listSyncableApiFootballEvents(supabase, options)
  const results: EventFixtureSyncResult[] = []

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!
    const result = await syncOneEvent(supabase, apiKey, event)
    results.push(result)
    if (i < events.length - 1) {
      await sleep(INTER_LEAGUE_DELAY_MS)
    }
  }

  const official = await ensureOfficialPoolsBestEffort(
    supabase,
    'sync-fixtures',
  )

  return {
    eventsConsidered: events.length,
    eventsSynced: results.filter((r) => r.status === 'success').length,
    eventsFailed: results.filter((r) => r.status === 'error').length,
    fixturesProcessed: results.reduce((n, r) => n + r.processed, 0),
    fixturesChanged: results.reduce((n, r) => n + r.upserted, 0),
    officialPoolsCreated: official.created,
    results,
  }
}
