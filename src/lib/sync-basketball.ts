import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchGamesByDate,
  fetchLeagueSeasonGames,
  isBasketballFinalStatus,
  isBasketballLiveStatus,
  isValidApiBasketballGameId,
  isValidBasketballSeason,
  mapBasketballStatusToMatchStatus,
  normalizeBasketballSeason,
  parseBasketballPoints,
  todayUtcDateString,
  type ApiBasketballGame,
} from '@/src/lib/api-basketball'
import { ensureOfficialPoolsBestEffort } from '@/src/lib/ensure-official-pools'
import {
  canFinalizeMatchByKickoff,
  logUpdaterGuardWarning,
} from '@/src/lib/match-updater-guards'
import { tryPostMatchMoments } from '@/src/lib/post-match-moments'
import { tryAwardPredictionXp } from '@/src/lib/xp'
import { tryRefreshMatchCrowdPicks } from '@/src/lib/match-crowd-picks'
import { tryNotifyPredictionScoredBatch } from '@/src/lib/notify-scoring-batch'
import { withTransientDbRetry } from '@/src/lib/db-transient-retry'
import { withSyncJob } from '@/src/lib/sync-jobs'

export const API_BASKETBALL_PROVIDER = 'api-basketball'

/** Neutral round for NBA (no tournament-round mapping yet). */
export const BASKETBALL_MATCH_ROUND = 'regular'

const UPSERT_BATCH_SIZE = 40
const LOOKUP_BATCH_SIZE = 100
/** NBA season + playoffs ~1.4k games; soft cap with headroom. */
const MAX_GAMES_PER_EVENT = 2500
const SCORE_BATCH_SIZE = 25

export type BasketballSportingEvent = {
  id: string
  name: string
  slug: string
  status: string
  provider: string | null
  provider_league_id: string | null
  provider_season: string | null
  event_type: string | null
}

export type BasketballSyncResult = {
  eventId: string
  eventName: string
  leagueId: number
  season: string
  fetched: number
  processed: number
  upserted: number
  rawOnlyUpdates: number
  newlyFinal: number
  pointsScored: number
  errors: string[]
  status: 'success' | 'error'
}

export type SyncBasketballSummary = {
  eventsConsidered: number
  eventsSynced: number
  eventsFailed: number
  gamesProcessed: number
  gamesChanged: number
  pointsScored: number
  officialPoolsCreated: number | null
  results: BasketballSyncResult[]
}

type ExistingMatch = {
  fixture_id: string
  is_final: boolean
}

function logoOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toUtcIso(dateStr: string): string {
  const ms = Date.parse(dateStr)
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid basketball game date: ${dateStr}`)
  }
  return new Date(ms).toISOString()
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
  game: ApiBasketballGame,
  eventId: string,
  existing: ExistingMatch | undefined,
): { row: Record<string, unknown>; newlyFinal: boolean } | null {
  const fixtureId = String(game.id)
  if (!isValidApiBasketballGameId(fixtureId)) return null

  const dateRaw = game.date?.trim()
  if (!dateRaw) return null
  const kickoffAt = toUtcIso(dateRaw)

  const statusShort = mapBasketballStatusToMatchStatus(game.status?.short)
  const points = parseBasketballPoints(game)
  const isFinal =
    statusShort != null &&
    isBasketballFinalStatus(statusShort) &&
    points != null

  const team1Name = game.teams?.home?.name?.trim()
  const team2Name = game.teams?.away?.name?.trim()
  if (!team1Name || !team2Name) return null

  const nowIso = new Date().toISOString()

  // Never overwrite finals already scored in DB (scoring pipeline owns those).
  if (existing?.is_final) {
    return {
      newlyFinal: false,
      row: {
        fixture_id: fixtureId,
        provider_raw: game,
        provider_raw_at: nowIso,
      },
    }
  }

  const newlyFinal = isFinal && !existing?.is_final

  return {
    newlyFinal,
    row: {
      fixture_id: fixtureId,
      event_id: eventId,
      kickoff_at: kickoffAt,
      locked_at: kickoffAt,
      team1_name: team1Name,
      team2_name: team2Name,
      team1_logo: logoOrNull(game.teams.home.logo),
      team2_logo: logoOrNull(game.teams.away.logo),
      round: BASKETBALL_MATCH_ROUND,
      group_name: null,
      status_short: statusShort,
      elapsed_minute: null,
      result_team1: points?.resultTeam1 ?? null,
      result_team2: points?.resultTeam2 ?? null,
      is_final: isFinal,
      advancing_team: null,
      match_number: null,
      team1_flag: null,
      team2_flag: null,
      provider_raw: game,
      provider_raw_at: nowIso,
    },
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
        failed.push(`${String(row.fixture_id)}: ${rowError.message}`)
      } else {
        ok += 1
      }
    }
  }

  return { ok, failed }
}

/**
 * Score newly finished basketball games via existing calculate_match_points RPC
 * (exact-score / winner logic — no draws expected).
 */
async function scoreNewlyFinalGames(
  supabase: SupabaseClient,
  fixtureIds: string[],
): Promise<{ scored: number; matchIds: string[]; errors: string[] }> {
  if (fixtureIds.length === 0) return { scored: 0, matchIds: [], errors: [] }

  let scored = 0
  const matchIds: string[] = []
  const errors: string[] = []

  for (let i = 0; i < fixtureIds.length; i += LOOKUP_BATCH_SIZE) {
    const batch = fixtureIds.slice(i, i + LOOKUP_BATCH_SIZE)
    const { data, error } = await supabase
      .from('matches')
      .select('id, fixture_id, is_final')
      .in('fixture_id', batch)
      .eq('is_final', true)

    if (error) {
      errors.push(`lookup finals: ${error.message}`)
      continue
    }

    for (let j = 0; j < (data ?? []).length; j += SCORE_BATCH_SIZE) {
      const slice = (data ?? []).slice(j, j + SCORE_BATCH_SIZE)
      await Promise.all(
        slice.map(async (match) => {
          const { error: rpcError } = await supabase.rpc(
            'calculate_match_points',
            { p_match_id: match.id },
          )
          if (rpcError) {
            errors.push(
              `${match.fixture_id}: calculate_match_points ${rpcError.message}`,
            )
          } else {
            scored += 1
            matchIds.push(match.id)
            await tryAwardPredictionXp(
              supabase,
              match.id,
              'sync-basketball:batch',
            )
          }
        }),
      )
    }
  }

  return { scored, matchIds, errors }
}

export async function listSyncableApiBasketballEvents(
  supabase: SupabaseClient,
  options?: { eventId?: string | null },
): Promise<BasketballSportingEvent[]> {
  return withTransientDbRetry('listSyncableApiBasketballEvents', async () => {
    let query = supabase
      .from('sporting_events')
      .select(
        'id, name, slug, status, provider, provider_league_id, provider_season, event_type',
      )
      .eq('provider', API_BASKETBALL_PROVIDER)
      .in('status', ['live', 'upcoming'])
      .order('name', { ascending: true })

    if (options?.eventId) {
      query = query.eq('id', options.eventId)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(
        `Failed to load basketball sporting_events: ${error.message}`,
      )
    }
    return (data ?? []) as BasketballSportingEvent[]
  })
}

async function syncOneBasketballEvent(
  supabase: SupabaseClient,
  apiKey: string,
  event: BasketballSportingEvent,
): Promise<BasketballSyncResult> {
  const leagueId = Number(event.provider_league_id)
  const season = normalizeBasketballSeason(event.provider_season) ?? ''
  const base: BasketballSyncResult = {
    eventId: event.id,
    eventName: event.name,
    leagueId,
    season,
    fetched: 0,
    processed: 0,
    upserted: 0,
    rawOnlyUpdates: 0,
    newlyFinal: 0,
    pointsScored: 0,
    errors: [],
    status: 'success',
  }

  if (!Number.isFinite(leagueId) || leagueId <= 0) {
    base.status = 'error'
    base.errors.push('Invalid provider_league_id')
    return base
  }
  if (!isValidBasketballSeason(season)) {
    base.status = 'error'
    base.errors.push(
      'Invalid provider_season (expected YYYY-YYYY string, e.g. 2026-2027)',
    )
    return base
  }

  return withSyncJob(
    supabase,
    {
      jobType: 'sync_basketball',
      eventId: event.id,
      detail: {
        leagueId,
        season,
        eventName: event.name,
        slug: event.slug,
      },
    },
    async () => {
      const games = await fetchLeagueSeasonGames(apiKey, leagueId, season)
      base.fetched = games.length

      const limited = games.slice(0, MAX_GAMES_PER_EVENT)
      const fixtureIds = limited.map((g) => String(g.id))
      const existing = await lookupExistingMatches(supabase, fixtureIds)

      const rows: Record<string, unknown>[] = []
      const newlyFinalIds: string[] = []
      let rawOnly = 0

      for (const game of limited) {
        const id = String(game.id)
        const built = buildMatchRow(game, event.id, existing.get(id))
        if (!built) continue
        if (existing.get(id)?.is_final) rawOnly += 1
        if (built.newlyFinal) newlyFinalIds.push(id)
        rows.push(built.row)
      }

      base.rawOnlyUpdates = rawOnly
      base.processed = rows.length
      base.newlyFinal = newlyFinalIds.length

      const { ok, failed } = await upsertMatchRows(supabase, rows)
      base.upserted = ok
      if (failed.length > 0) {
        base.errors.push(...failed.slice(0, 25))
        base.status = failed.length === rows.length ? 'error' : 'success'
      }

      if (newlyFinalIds.length > 0 && base.status !== 'error') {
        const scored = await scoreNewlyFinalGames(supabase, newlyFinalIds)
        base.pointsScored = scored.scored
        if (scored.errors.length > 0) {
          base.errors.push(...scored.errors.slice(0, 25))
        }
        if (scored.scored > 0) {
          await tryRefreshMatchCrowdPicks(supabase, 'sync-basketball:batch')
          await tryNotifyPredictionScoredBatch(
            supabase,
            scored.matchIds,
            'sync-basketball:batch',
          )
        }
      }

      const syncStatus =
        base.status === 'error'
          ? 'error'
          : failed.length > 0 || base.errors.length > 0
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
          base.errors[0] ?? `Basketball sync failed for ${event.name}`,
        )
      }

      return {
        itemsProcessed: base.processed,
        itemsChanged: base.upserted,
        partial: failed.length > 0 || base.errors.length > 0,
        detail: {
          fetched: base.fetched,
          rawOnlyUpdates: base.rawOnlyUpdates,
          newlyFinal: base.newlyFinal,
          pointsScored: base.pointsScored,
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
 * Ingest NBA (api-basketball) games into matches for syncable sporting_events.
 */
export async function syncBasketballFromApi(
  supabase: SupabaseClient,
  apiKey: string,
  options?: { eventId?: string | null },
): Promise<SyncBasketballSummary> {
  const events = await listSyncableApiBasketballEvents(supabase, options)
  const results: BasketballSyncResult[] = []

  for (const event of events) {
    const result = await syncOneBasketballEvent(supabase, apiKey, event)
    results.push(result)
  }

  const official = await ensureOfficialPoolsBestEffort(
    supabase,
    'sync-basketball',
  )

  return {
    eventsConsidered: events.length,
    eventsSynced: results.filter((r) => r.status === 'success').length,
    eventsFailed: results.filter((r) => r.status === 'error').length,
    gamesProcessed: results.reduce((n, r) => n + r.processed, 0),
    gamesChanged: results.reduce((n, r) => n + r.upserted, 0),
    pointsScored: results.reduce((n, r) => n + r.pointsScored, 0),
    officialPoolsCreated: official.created,
    results,
  }
}

/** Cheap live poll window — NBA + OT / delays. */
const LIVE_PRE_KICKOFF_MINUTES = 5
const LIVE_MATCH_MAX_AGE_MINUTES = 360

export type SyncBasketballLiveSummary = {
  matchesChecked: number
  matchesUpdated: number
  matchesSkipped: number
  pointsScored: number
  apiMissing: number
  errors: string[]
  skipped?: string
}

type BasketballLiveMatchRow = {
  id: string
  fixture_id: string | null
  kickoff_at: string
  result_team1: number | null
  result_team2: number | null
  is_final: boolean
  status_short: string | null
  event_id: string | null
}

/**
 * Frequent live-score path: poll only basketball games that are live or should
 * be underway. Does not fetch the full season (that is syncBasketballFromApi).
 *
 * Uses /games?league&season&date (NOT unsupported `ids`) — typically 1 call
 * per event for today's slate; also covers candidate kickoff dates.
 */
export async function syncBasketballLiveScores(
  supabase: SupabaseClient,
  apiKey: string,
): Promise<SyncBasketballLiveSummary> {
  const empty = (
    skipped?: string,
  ): SyncBasketballLiveSummary => ({
    matchesChecked: 0,
    matchesUpdated: 0,
    matchesSkipped: 0,
    pointsScored: 0,
    apiMissing: 0,
    errors: [],
    skipped,
  })

  const events = await listSyncableApiBasketballEvents(supabase)
  if (events.length === 0) {
    return empty('no_basketball_events')
  }

  const eventIds = events.map((e) => e.id)
  const nowMs = Date.now()
  const windowStart = new Date(
    nowMs - LIVE_MATCH_MAX_AGE_MINUTES * 60_000,
  ).toISOString()
  const windowEnd = new Date(
    nowMs + LIVE_PRE_KICKOFF_MINUTES * 60_000,
  ).toISOString()

  const windowProbe = await withTransientDbRetry(
    'syncBasketballLiveScores:windowProbe',
    async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id')
        .in('event_id', eventIds)
        .eq('is_final', false)
        .lte('kickoff_at', windowEnd)
        .gt('kickoff_at', windowStart)
        .limit(1)
      if (error) {
        throw new Error(
          `Failed to check basketball live window: ${error.message}`,
        )
      }
      return data
    },
  )

  if (!windowProbe?.[0]) {
    return empty('no_live_window')
  }

  const liveRows = await withTransientDbRetry(
    'syncBasketballLiveScores:liveMatches',
    async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(
          'id, fixture_id, kickoff_at, result_team1, result_team2, is_final, status_short, event_id',
        )
        .in('event_id', eventIds)
        .eq('is_final', false)
        .lte('kickoff_at', windowEnd)
        .gt('kickoff_at', windowStart)
      if (error) {
        throw new Error(
          `Failed to load basketball live matches: ${error.message}`,
        )
      }
      return data
    },
  )

  const candidates = ((liveRows ?? []) as BasketballLiveMatchRow[]).filter(
    (match) => isValidApiBasketballGameId(match.fixture_id),
  )

  if (candidates.length === 0) {
    return empty('no_pollable_matches')
  }

  const datesNeeded = new Set<string>([todayUtcDateString()])
  for (const match of candidates) {
    const d = new Date(match.kickoff_at).toISOString().slice(0, 10)
    if (d) datesNeeded.add(d)
  }

  const gameById = new Map<string, ApiBasketballGame>()
  for (const event of events) {
    const leagueId = Number(event.provider_league_id)
    const season = normalizeBasketballSeason(event.provider_season)
    if (!Number.isFinite(leagueId) || leagueId <= 0) continue
    if (!season) continue

    for (const date of datesNeeded) {
      const games = await fetchGamesByDate(apiKey, leagueId, season, date)
      for (const game of games) {
        gameById.set(String(game.id), game)
      }
    }
  }

  let matchesUpdated = 0
  let matchesSkipped = 0
  let pointsScored = 0
  let apiMissing = 0
  const errors: string[] = []
  const scoredMatchIds: string[] = []

  for (const match of candidates) {
    const fixtureId = match.fixture_id as string
    const game = gameById.get(fixtureId)

    if (!game) {
      apiMissing += 1
      matchesSkipped += 1
      continue
    }

    const statusShort = mapBasketballStatusToMatchStatus(game.status?.short)
    if (!statusShort) {
      matchesSkipped += 1
      continue
    }

    const points = parseBasketballPoints(game)
    const apiLive = isBasketballLiveStatus(statusShort)
    let apiFinal = isBasketballFinalStatus(statusShort) && points != null

    if (apiFinal && !canFinalizeMatchByKickoff(match.kickoff_at, nowMs)) {
      logUpdaterGuardWarning(
        'sync-basketball-live',
        'Refusing early finalize — API reported FT/AOT before minimum kickoff window elapsed',
        {
          matchId: match.id,
          fixtureId,
          kickoffAt: match.kickoff_at,
          apiStatus: statusShort,
        },
      )
      apiFinal = false
    }

    if (
      !apiFinal &&
      !apiLive &&
      statusShort === 'NS' &&
      match.status_short === 'NS' &&
      points == null
    ) {
      matchesSkipped += 1
      continue
    }

    const scoreChanged =
      points != null &&
      (match.result_team1 !== points.resultTeam1 ||
        match.result_team2 !== points.resultTeam2)
    const statusChanged = statusShort !== match.status_short
    const becomingFinal = apiFinal && !match.is_final

    if (!scoreChanged && !statusChanged && !becomingFinal) {
      matchesSkipped += 1
      continue
    }

    const nowUpdateIso = new Date().toISOString()
    const updatePayload: Record<string, unknown> = {
      status_short: statusShort,
      provider_raw: game,
      provider_raw_at: nowUpdateIso,
    }

    if (points != null) {
      updatePayload.result_team1 = points.resultTeam1
      updatePayload.result_team2 = points.resultTeam2
    }

    if (becomingFinal) {
      updatePayload.is_final = true
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update(updatePayload)
      .eq('id', match.id)
      .eq('is_final', false)

    if (updateError) {
      errors.push(`${fixtureId}: ${updateError.message}`)
      continue
    }

    matchesUpdated += 1

    if (becomingFinal) {
      const { error: rpcError } = await supabase.rpc('calculate_match_points', {
        p_match_id: match.id,
      })
      if (rpcError) {
        errors.push(
          `${fixtureId}: calculate_match_points ${rpcError.message}`,
        )
      } else {
        pointsScored += 1
        scoredMatchIds.push(match.id)
        await tryPostMatchMoments(supabase, match.id, 'sync-basketball-live')
        await tryAwardPredictionXp(supabase, match.id, 'sync-basketball-live')
      }
    }
  }

  if (pointsScored > 0) {
    await tryRefreshMatchCrowdPicks(supabase, 'sync-basketball-live')
    await tryNotifyPredictionScoredBatch(
      supabase,
      scoredMatchIds,
      'sync-basketball-live',
    )
  }

  return {
    matchesChecked: candidates.length,
    matchesUpdated,
    matchesSkipped,
    pointsScored,
    apiMissing,
    errors,
  }
}
