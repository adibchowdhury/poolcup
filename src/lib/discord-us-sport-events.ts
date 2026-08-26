import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isDiscordChannelConfigured,
  processDiscordEvent,
} from '@/src/lib/discord-pucky'
import {
  basketballPeriodHeadline,
  formatSportFinalMessage,
  formatSportPeriodMessage,
  formatSportReminderMessage,
  formatSportScoreMessage,
  formatSportStartMessage,
  formatSportVoidMessage,
  periodLabelFromStatus,
  US_SPORT_PRE_GAME_STATUSES,
  US_SPORT_VOID_STATUSES,
  type DiscordUsSportKey,
  type MatchDiscordMessageContext,
} from '@/src/lib/discord-sport-messages'

export type { DiscordUsSportKey }

export type UsSportMatchDiscordContext = MatchDiscordMessageContext & {
  matchId: string
}

/** Provider on sporting_events → Discord channel key. */
export const PROVIDER_TO_DISCORD_CHANNEL: Record<
  string,
  DiscordUsSportKey | 'soccer'
> = {
  'api-football': 'soccer',
  'api-american-football': 'football',
  'api-basketball': 'basketball',
  'api-baseball': 'baseball',
  'api-hockey': 'hockey',
}

export const US_SPORT_PROVIDERS = [
  'api-american-football',
  'api-basketball',
  'api-baseball',
  'api-hockey',
] as const

/** One batch query per sync run — not per match. */
export async function loadSportEventNameMap(
  supabase: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(eventIds.filter(Boolean))]
  if (unique.length === 0) return new Map()

  try {
    const { data, error } = await supabase
      .from('sporting_events')
      .select('id, name')
      .in('id', unique)

    if (error) {
      console.error('loadSportEventNameMap: select failed', {
        message: error.message,
        code: error.code,
      })
      return new Map()
    }

    const map = new Map<string, string>()
    for (const row of data ?? []) {
      if (row.id && row.name) map.set(String(row.id), String(row.name))
    }
    return map
  } catch (err) {
    console.error('loadSportEventNameMap: unexpected error', { err })
    return new Map()
  }
}

export function resolveSportEventName(
  eventNameById: Map<string, string>,
  eventId: string | null | undefined,
): string | null {
  if (!eventId) return null
  return eventNameById.get(eventId) ?? null
}

function isPreGameStatus(status: string | null | undefined): boolean {
  if (!status) return true
  return US_SPORT_PRE_GAME_STATUSES.has(status.trim().toUpperCase())
}

function isVoidStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return US_SPORT_VOID_STATUSES.has(status.trim().toUpperCase())
}

/** Never throws — no-ops when that sport's Discord channel env is absent. */
export async function tryEmitUsSportKickoff(
  supabase: SupabaseClient,
  sport: DiscordUsSportKey,
  ctx: UsSportMatchDiscordContext,
  beforeStatus: string | null | undefined,
  afterStatus: string,
): Promise<void> {
  if (!isDiscordChannelConfigured(sport)) return
  if (!isPreGameStatus(beforeStatus)) return
  const after = afterStatus.trim().toUpperCase()
  if (isPreGameStatus(after) || isVoidStatus(after)) return

  const content = formatSportStartMessage(sport, ctx)

  try {
    await processDiscordEvent({
      supabase,
      matchId: ctx.matchId,
      eventType: 'kickoff',
      channelKey: sport,
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitUsSportKickoff failed', {
      sport,
      matchId: ctx.matchId,
      err,
    })
  }
}

/**
 * Football / hockey / baseball score ticks (not basketball — use period emits).
 * Never throws.
 */
export async function tryEmitUsSportScoreChange(
  supabase: SupabaseClient,
  sport: Exclude<DiscordUsSportKey, 'basketball'>,
  ctx: UsSportMatchDiscordContext,
  beforeScores: { t1: number | null; t2: number | null },
  afterScores: { t1: number; t2: number },
  statusShort?: string | null,
): Promise<void> {
  if (!isDiscordChannelConfigured(sport)) return
  if (
    beforeScores.t1 === afterScores.t1 &&
    beforeScores.t2 === afterScores.t2
  ) {
    return
  }

  const content = formatSportScoreMessage(
    sport,
    ctx,
    afterScores,
    periodLabelFromStatus(sport, statusShort),
  )

  try {
    await processDiscordEvent({
      supabase,
      matchId: ctx.matchId,
      eventType: `score_${afterScores.t1}-${afterScores.t2}`,
      channelKey: sport,
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitUsSportScoreChange failed', {
      sport,
      matchId: ctx.matchId,
      err,
    })
  }
}

/**
 * Basketball only: emit at live period transitions (Q1→Q2, →HT, …), not every score.
 * Never throws.
 */
export async function tryEmitUsSportPeriodTransition(
  supabase: SupabaseClient,
  ctx: UsSportMatchDiscordContext,
  beforeStatus: string | null | undefined,
  afterStatus: string,
  scores: { t1: number; t2: number } | null,
): Promise<void> {
  if (!isDiscordChannelConfigured('basketball')) return
  if (scores == null) return

  const before = (beforeStatus ?? '').trim().toUpperCase()
  const after = afterStatus.trim().toUpperCase()
  if (!after || before === after) return
  if (isPreGameStatus(before) && !isPreGameStatus(after)) {
    // Kickoff handles NS → Q1; do not also post a period break.
    return
  }

  const headline = basketballPeriodHeadline(after)
  if (!headline) return

  const content = formatSportPeriodMessage('basketball', ctx, headline, scores)

  try {
    await processDiscordEvent({
      supabase,
      matchId: ctx.matchId,
      eventType: `period_${after}`,
      channelKey: 'basketball',
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitUsSportPeriodTransition failed', {
      matchId: ctx.matchId,
      err,
    })
  }
}

/** Never throws — no-ops when channel env is absent. */
export async function tryEmitUsSportFinal(
  supabase: SupabaseClient,
  sport: DiscordUsSportKey,
  ctx: UsSportMatchDiscordContext,
  resultTeam1: number,
  resultTeam2: number,
  statusShort: string,
): Promise<void> {
  if (!isDiscordChannelConfigured(sport)) return

  const content = formatSportFinalMessage(
    sport,
    ctx,
    resultTeam1,
    resultTeam2,
    statusShort,
  )

  try {
    await processDiscordEvent({
      supabase,
      matchId: ctx.matchId,
      eventType: 'final',
      channelKey: sport,
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitUsSportFinal failed', {
      sport,
      matchId: ctx.matchId,
      err,
    })
  }
}

/**
 * Emit when status becomes PST (API POST). No points-void RPC exists on these
 * paths — Discord-only signal. Never throws.
 */
export async function tryEmitUsSportVoid(
  supabase: SupabaseClient,
  sport: DiscordUsSportKey,
  ctx: UsSportMatchDiscordContext,
  beforeStatus: string | null | undefined,
  afterStatus: string,
): Promise<void> {
  if (!isDiscordChannelConfigured(sport)) return
  if (!isVoidStatus(afterStatus)) return
  if (isVoidStatus(beforeStatus)) return

  const content = formatSportVoidMessage(sport, ctx, afterStatus)

  try {
    await processDiscordEvent({
      supabase,
      matchId: ctx.matchId,
      eventType: 'void',
      channelKey: sport,
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitUsSportVoid failed', {
      sport,
      matchId: ctx.matchId,
      err,
    })
  }
}

/** Never throws — no-ops when channel env is absent. */
export async function tryEmitUsSportMatchReminder(
  supabase: SupabaseClient,
  sport: DiscordUsSportKey,
  ctx: UsSportMatchDiscordContext,
  kickoffAtIso: string,
): Promise<void> {
  if (!isDiscordChannelConfigured(sport)) return

  let content: string
  try {
    content = formatSportReminderMessage(sport, ctx, kickoffAtIso)
  } catch {
    return
  }

  try {
    await processDiscordEvent({
      supabase,
      matchId: ctx.matchId,
      eventType: 'reminder',
      channelKey: sport,
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitUsSportMatchReminder failed', {
      sport,
      matchId: ctx.matchId,
      err,
    })
  }
}

/**
 * Season-sync path: after newly-final games are scored, emit finals (dedupe-safe).
 * Never throws.
 */
export async function tryEmitUsSportFinalsForMatchIds(
  supabase: SupabaseClient,
  sport: DiscordUsSportKey,
  matchIds: string[],
): Promise<void> {
  if (!isDiscordChannelConfigured(sport)) return
  if (matchIds.length === 0) return

  try {
    const { data, error } = await supabase
      .from('matches')
      .select(
        'id, team1_name, team2_name, result_team1, result_team2, status_short, event_id',
      )
      .in('id', matchIds)

    if (error) {
      console.error('tryEmitUsSportFinalsForMatchIds: select failed', {
        sport,
        message: error.message,
      })
      return
    }

    const rows = data ?? []
    const eventNameById = await loadSportEventNameMap(
      supabase,
      rows.map((r) => String(r.event_id ?? '')).filter(Boolean),
    )

    for (const row of rows) {
      if (row.result_team1 == null || row.result_team2 == null) continue
      await tryEmitUsSportFinal(
        supabase,
        sport,
        {
          matchId: String(row.id),
          team1Name: String(row.team1_name ?? 'TBD'),
          team2Name: String(row.team2_name ?? 'TBD'),
          eventName: resolveSportEventName(
            eventNameById,
            row.event_id == null ? null : String(row.event_id),
          ),
        },
        Number(row.result_team1),
        Number(row.result_team2),
        String(row.status_short ?? 'FT'),
      )
    }
  } catch (err) {
    console.error('tryEmitUsSportFinalsForMatchIds failed', { sport, err })
  }
}
