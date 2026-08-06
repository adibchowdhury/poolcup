/**
 * Shared team-roster refresh used by scripts/ingest-rosters.ts and
 * app/api/cron/refresh-rosters.
 *
 * - Upserts new teams into public.teams from match logo URLs
 * - Refreshes public.team_players via API-Football /players/squads
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTeamApiIdFromLogoUrl } from '@/src/lib/team-logos'

const API_BASE = 'https://v3.football.api-sports.io'

/** Stay well under API-Football's 300 req/min limit. */
export const ROSTER_REFRESH_DELAY_MS = 300

/** Prefer refreshing empty + stale rosters only (weekly cron → ~full refresh). */
export const ROSTER_STALE_AFTER_DAYS = 6

const MATCH_PAGE_SIZE = 1000
const UPSERT_BATCH_SIZE = 100

export type TeamCatalogRow = {
  api_id: number
  name: string
  logo: string | null
}

type ApiSquadPlayer = {
  id: number
  name: string
  number?: number | null
  position?: string | null
  photo?: string | null
}

type ApiSquadResponse = {
  response?: Array<{
    team?: { id: number; name: string; logo?: string | null }
    players?: ApiSquadPlayer[]
  }>
  errors?: Record<string, string> | string[]
}

type TeamPlayerUpsert = {
  team_api_id: number
  api_id: number
  name: string
  photo: string | null
  number: number | null
  position: string | null
  updated_at: string
}

export type RosterRefreshOptions = {
  /** When true, refresh every team in the catalog (manual script default). */
  forceAll?: boolean
  /** Override stale window (days). */
  staleAfterDays?: number
  delayBetweenTeamMs?: number
  logger?: (message: string) => void
}

export type RosterRefreshSummary = {
  catalogTeamsBefore: number
  catalogTeamsUpserted: number
  catalogTeamsAfter: number
  teamsEligible: number
  teamsSkippedFresh: number
  teamsProcessed: number
  teamsWithPlayers: number
  teamsEmptySquad: number
  teamsFailed: number
  playersUpserted: number
  playersSkippedInvalid: number
  forceAll: boolean
  staleAfterDays: number
  delayBetweenTeamMs: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function logLine(
  logger: ((message: string) => void) | undefined,
  message: string,
) {
  if (logger) logger(message)
  else console.log(message)
}

function normalizePhoto(photo: string | null | undefined): string | null {
  if (typeof photo !== 'string') return null
  const trimmed = photo.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizePosition(
  position: string | null | undefined,
): string | null {
  if (typeof position !== 'string') return null
  const trimmed = position.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.trunc(value)
}

function rememberTeam(
  byId: Map<number, TeamCatalogRow>,
  name: string | null | undefined,
  logo: string | null | undefined,
) {
  const apiId = parseTeamApiIdFromLogoUrl(logo)
  if (apiId == null) return

  const trimmedName = typeof name === 'string' ? name.trim() : ''
  const logoUrl = typeof logo === 'string' ? logo.trim() : null
  const existing = byId.get(apiId)

  byId.set(apiId, {
    api_id: apiId,
    name: trimmedName || existing?.name || `Team ${apiId}`,
    logo: logoUrl || existing?.logo || null,
  })
}

async function fetchSquad(
  apiKey: string,
  teamApiId: number,
): Promise<ApiSquadPlayer[]> {
  const url = `${API_BASE}/players/squads?team=${teamApiId}`
  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  })

  const raw = (await res.json()) as ApiSquadResponse

  if (!res.ok) {
    throw new Error(
      `API-Football request failed: ${res.status} ${res.statusText}`,
    )
  }

  if (raw.errors) {
    if (Array.isArray(raw.errors) && raw.errors.length > 0) {
      throw new Error(`API-Football error: ${JSON.stringify(raw.errors)}`)
    }
    if (
      typeof raw.errors === 'object' &&
      Object.keys(raw.errors).length > 0
    ) {
      throw new Error(`API-Football error: ${JSON.stringify(raw.errors)}`)
    }
  }

  return raw.response?.[0]?.players ?? []
}

/**
 * Upsert teams discovered from matches.team*_logo URLs into public.teams.
 * Match ingestion does not maintain the catalog — this keeps it fresh.
 */
export async function syncTeamsCatalogFromMatches(
  supabase: SupabaseClient,
  logger?: (message: string) => void,
): Promise<{ upserted: number }> {
  const byId = new Map<number, TeamCatalogRow>()
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from('matches')
      .select('team1_name, team1_logo, team2_name, team2_logo')
      .range(from, from + MATCH_PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Failed to scan matches for teams: ${error.message}`)
    }

    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      rememberTeam(
        byId,
        row.team1_name as string | null,
        row.team1_logo as string | null,
      )
      rememberTeam(
        byId,
        row.team2_name as string | null,
        row.team2_logo as string | null,
      )
    }

    if (rows.length < MATCH_PAGE_SIZE) break
    from += MATCH_PAGE_SIZE
  }

  const catalog = [...byId.values()]
  if (catalog.length === 0) {
    logLine(logger, 'Catalog sync: no team ids parsed from match logos')
    return { upserted: 0 }
  }

  let upserted = 0
  for (let i = 0; i < catalog.length; i += UPSERT_BATCH_SIZE) {
    const batch = catalog.slice(i, i + UPSERT_BATCH_SIZE)
    const { error } = await supabase
      .from('teams')
      .upsert(batch, { onConflict: 'api_id' })

    if (error) {
      throw new Error(`Failed to upsert teams catalog: ${error.message}`)
    }
    upserted += batch.length
  }

  logLine(
    logger,
    `Catalog sync: upserted ${upserted} teams from match logo URLs`,
  )
  return { upserted }
}

async function loadRosterFreshness(
  supabase: SupabaseClient,
): Promise<Map<number, string>> {
  const freshness = new Map<number, string>()
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from('team_players')
      .select('team_api_id, updated_at')
      .range(from, from + MATCH_PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Failed to load roster freshness: ${error.message}`)
    }

    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const teamApiId = Number(row.team_api_id)
      const updatedAt =
        typeof row.updated_at === 'string' ? row.updated_at : null
      if (!Number.isFinite(teamApiId) || !updatedAt) continue

      const previous = freshness.get(teamApiId)
      if (!previous || updatedAt > previous) {
        freshness.set(teamApiId, updatedAt)
      }
    }

    if (rows.length < MATCH_PAGE_SIZE) break
    from += MATCH_PAGE_SIZE
  }

  return freshness
}

function isRosterStale(
  updatedAt: string | undefined,
  staleAfterMs: number,
  nowMs: number,
): boolean {
  if (!updatedAt) return true
  const ts = Date.parse(updatedAt)
  if (!Number.isFinite(ts)) return true
  return nowMs - ts >= staleAfterMs
}

export async function refreshTeamRosters(
  supabase: SupabaseClient,
  apiKey: string,
  options: RosterRefreshOptions = {},
): Promise<RosterRefreshSummary> {
  const forceAll = options.forceAll === true
  const staleAfterDays = options.staleAfterDays ?? ROSTER_STALE_AFTER_DAYS
  const delayBetweenTeamMs =
    options.delayBetweenTeamMs ?? ROSTER_REFRESH_DELAY_MS
  const logger = options.logger
  const staleAfterMs = staleAfterDays * 24 * 60 * 60 * 1000
  const nowMs = Date.now()

  logLine(logger, '=== Team roster refresh ===')
  logLine(
    logger,
    `Throttle: ${delayBetweenTeamMs}ms · stale after ${staleAfterDays}d · forceAll=${forceAll}`,
  )

  const { data: beforeTeams, error: beforeError } = await supabase
    .from('teams')
    .select('api_id')

  if (beforeError) {
    throw new Error(`Failed to count teams: ${beforeError.message}`)
  }

  const catalogTeamsBefore = beforeTeams?.length ?? 0
  const catalogSync = await syncTeamsCatalogFromMatches(supabase, logger)

  const { data: teamsData, error: teamsError } = await supabase
    .from('teams')
    .select('api_id, name, logo')
    .order('api_id', { ascending: true })

  if (teamsError) {
    throw new Error(`Failed to load public.teams: ${teamsError.message}`)
  }

  const teams = (teamsData ?? []) as TeamCatalogRow[]
  const catalogTeamsAfter = teams.length

  const freshness = forceAll
    ? new Map<number, string>()
    : await loadRosterFreshness(supabase)

  const eligible = forceAll
    ? teams
    : teams.filter((team) =>
        isRosterStale(freshness.get(team.api_id), staleAfterMs, nowMs),
      )

  const teamsSkippedFresh = forceAll
    ? 0
    : Math.max(0, teams.length - eligible.length)

  logLine(
    logger,
    `Teams: catalog ${catalogTeamsAfter} · eligible ${eligible.length} · skipped fresh ${teamsSkippedFresh}`,
  )

  let teamsProcessed = 0
  let teamsWithPlayers = 0
  let teamsEmptySquad = 0
  let teamsFailed = 0
  let playersUpserted = 0
  let playersSkippedInvalid = 0

  for (let index = 0; index < eligible.length; index++) {
    const team = eligible[index]!
    const label = `[${index + 1}/${eligible.length}] ${team.name} (api_id=${team.api_id})`
    const hadRoster = freshness.has(team.api_id)

    try {
      const players = await fetchSquad(apiKey, team.api_id)

      if (players.length === 0) {
        teamsEmptySquad++
        teamsProcessed++
        logLine(
          logger,
          `${label} — no squad returned (skip)${hadRoster ? '' : ' [new]'}`,
        )
      } else {
        const nowIso = new Date().toISOString()
        const rows: TeamPlayerUpsert[] = []

        for (const player of players) {
          if (
            typeof player.id !== 'number' ||
            !Number.isFinite(player.id) ||
            typeof player.name !== 'string' ||
            !player.name.trim()
          ) {
            playersSkippedInvalid++
            continue
          }

          rows.push({
            team_api_id: team.api_id,
            api_id: Math.trunc(player.id),
            name: player.name.trim(),
            photo: normalizePhoto(player.photo),
            number: normalizeNumber(player.number ?? null),
            position: normalizePosition(player.position),
            updated_at: nowIso,
          })
        }

        if (rows.length === 0) {
          teamsEmptySquad++
          teamsProcessed++
          logLine(logger, `${label} — squad empty after validation (skip)`)
        } else {
          const { error: upsertError } = await supabase
            .from('team_players')
            .upsert(rows, { onConflict: 'team_api_id,api_id' })

          if (upsertError) {
            teamsFailed++
            logLine(logger, `${label} — UPSERT FAILED: ${upsertError.message}`)
          } else {
            teamsWithPlayers++
            teamsProcessed++
            playersUpserted += rows.length
            const withPhoto = rows.filter((row) => row.photo != null).length
            logLine(
              logger,
              `${label} — upserted ${rows.length} players (${withPhoto} with photo)${
                hadRoster ? '' : ' [new]'
              }`,
            )
          }
        }
      }
    } catch (err) {
      teamsFailed++
      const message = err instanceof Error ? err.message : String(err)
      logLine(logger, `${label} — ERROR: ${message}`)
    }

    if (index < eligible.length - 1) {
      await sleep(delayBetweenTeamMs)
    }
  }

  const summary: RosterRefreshSummary = {
    catalogTeamsBefore,
    catalogTeamsUpserted: catalogSync.upserted,
    catalogTeamsAfter,
    teamsEligible: eligible.length,
    teamsSkippedFresh,
    teamsProcessed,
    teamsWithPlayers,
    teamsEmptySquad,
    teamsFailed,
    playersUpserted,
    playersSkippedInvalid,
    forceAll,
    staleAfterDays,
    delayBetweenTeamMs,
  }

  logLine(logger, '========== ROSTER REFRESH TOTAL ==========')
  logLine(
    logger,
    `Catalog: before=${summary.catalogTeamsBefore} upserted=${summary.catalogTeamsUpserted} after=${summary.catalogTeamsAfter}`,
  )
  logLine(
    logger,
    `Eligible=${summary.teamsEligible} skippedFresh=${summary.teamsSkippedFresh}`,
  )
  logLine(
    logger,
    `Processed=${summary.teamsProcessed} withPlayers=${summary.teamsWithPlayers} empty=${summary.teamsEmptySquad} failed=${summary.teamsFailed}`,
  )
  logLine(
    logger,
    `Players upserted=${summary.playersUpserted} invalidSkipped=${summary.playersSkippedInvalid}`,
  )

  return summary
}
