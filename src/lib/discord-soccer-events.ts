import type { SupabaseClient } from '@supabase/supabase-js'
import { LIVE_MATCH_STATUSES } from '@/src/lib/api-football'
import { normalizeMatchStatusShort } from '@/src/lib/match-void-status'
import {
  isDiscordEnvConfigured,
  processDiscordEvent,
} from '@/src/lib/discord-pucky'

export type SoccerMatchDiscordContext = {
  matchId: string
  team1Name: string
  team2Name: string
  eventName?: string | null
}

/** Message-only fields shared by production hooks and preview. */
export type SoccerMatchDiscordMessageContext = Pick<
  SoccerMatchDiscordContext,
  'team1Name' | 'team2Name' | 'eventName'
>

/** One batch query per sync/reconcile run — not per match. */
export async function loadSoccerEventNameMap(
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
      console.error('loadSoccerEventNameMap: select failed', {
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
    console.error('loadSoccerEventNameMap: unexpected error', { err })
    return new Map()
  }
}

export function resolveEventName(
  eventNameById: Map<string, string>,
  eventId: string | null | undefined,
): string | null {
  if (!eventId) return null
  return eventNameById.get(eventId) ?? null
}

function withCompetitionPrefix(
  content: string,
  eventName?: string | null,
): string {
  const label = eventName?.trim()
  if (!label) return content
  return `[${label}] ${content}`
}

export function formatDiscordKickoffMessage(
  ctx: SoccerMatchDiscordMessageContext,
): string {
  return withCompetitionPrefix(
    `🔴 LIVE — ${ctx.team1Name} vs ${ctx.team2Name} has kicked off! Picks are locked — good luck everyone 🍀`,
    ctx.eventName,
  )
}

export function formatDiscordScoreChangeMessage(
  ctx: SoccerMatchDiscordMessageContext,
  afterScores: { t1: number; t2: number },
  elapsedMinute: number | null | undefined,
): string {
  const minuteSuffix =
    elapsedMinute != null ? ` (${elapsedMinute}')` : ''
  return withCompetitionPrefix(
    `⚽ GOAL! ${ctx.team1Name} ${afterScores.t1}-${afterScores.t2} ${ctx.team2Name}${minuteSuffix}`,
    ctx.eventName,
  )
}

export function formatDiscordFinalMessage(
  ctx: SoccerMatchDiscordMessageContext,
  resultTeam1: number,
  resultTeam2: number,
  statusShort: string,
): string {
  return withCompetitionPrefix(
    `🏁 FULL TIME — ${ctx.team1Name} ${resultTeam1}-${resultTeam2} ${ctx.team2Name}${finalStatusSuffix(statusShort)}`,
    ctx.eventName,
  )
}

export function formatDiscordVoidMessage(
  ctx: SoccerMatchDiscordMessageContext,
  voidStatusShort: string,
): string {
  const phrase = voidStatusPhrase(voidStatusShort)
  return withCompetitionPrefix(
    `⚠️ ${ctx.team1Name} vs ${ctx.team2Name} has been ${phrase}`,
    ctx.eventName,
  )
}

export function formatDiscordMatchReminderMessage(
  ctx: SoccerMatchDiscordMessageContext,
  kickoffAtIso: string,
): string {
  const unix = Math.floor(new Date(kickoffAtIso).getTime() / 1000)
  if (!Number.isFinite(unix)) {
    throw new Error('Invalid kickoff timestamp for reminder message')
  }
  return withCompetitionPrefix(
    `⏰ ${ctx.team1Name} vs ${ctx.team2Name} kicks off <t:${unix}:R> — get your picks in before kickoff!`,
    ctx.eventName,
  )
}

function voidStatusPhrase(statusShort: string): string {
  switch (normalizeMatchStatusShort(statusShort)) {
    case 'PST':
      return 'postponed'
    case 'CANC':
      return 'cancelled'
    case 'ABD':
      return 'abandoned'
    case 'AWD':
      return 'awarded'
    case 'WO':
      return 'walkover'
    default:
      return 'voided'
  }
}

function finalStatusSuffix(statusShort: string): string {
  const status = normalizeMatchStatusShort(statusShort)
  if (status === 'AET') return ' (after extra time)'
  if (status === 'PEN') return ' (on penalties)'
  return ''
}

function isKickoffTransition(
  beforeStatus: string | null | undefined,
  afterStatus: string,
): boolean {
  const before = normalizeMatchStatusShort(beforeStatus)
  const after = normalizeMatchStatusShort(afterStatus)
  return before === 'NS' && LIVE_MATCH_STATUSES.has(after)
}

/** Never throws — no-ops when Discord env is absent. */
export async function tryEmitDiscordKickoff(
  supabase: SupabaseClient,
  ctx: SoccerMatchDiscordContext,
  beforeStatus: string | null | undefined,
  afterStatus: string,
): Promise<void> {
  if (!isDiscordEnvConfigured()) return
  if (!isKickoffTransition(beforeStatus, afterStatus)) return

  const content = formatDiscordKickoffMessage(ctx)

  try {
    await processDiscordEvent({
      supabase,
      matchId: ctx.matchId,
      eventType: 'kickoff',
      channelKey: 'soccer',
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitDiscordKickoff failed', { matchId: ctx.matchId, err })
  }
}

/** Never throws — no-ops when Discord env is absent. */
export async function tryEmitDiscordScoreChange(
  supabase: SupabaseClient,
  ctx: SoccerMatchDiscordContext,
  beforeScores: { t1: number | null; t2: number | null },
  afterScores: { t1: number; t2: number },
  elapsedMinute: number | null | undefined,
): Promise<void> {
  if (!isDiscordEnvConfigured()) return
  if (
    beforeScores.t1 === afterScores.t1 &&
    beforeScores.t2 === afterScores.t2
  ) {
    return
  }

  const content = formatDiscordScoreChangeMessage(
    ctx,
    afterScores,
    elapsedMinute,
  )

  try {
    await processDiscordEvent({
      supabase,
      matchId: ctx.matchId,
      eventType: `score_${afterScores.t1}-${afterScores.t2}`,
      channelKey: 'soccer',
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitDiscordScoreChange failed', {
      matchId: ctx.matchId,
      err,
    })
  }
}

/** Never throws — no-ops when Discord env is absent. */
export async function tryEmitDiscordFinal(
  supabase: SupabaseClient,
  ctx: SoccerMatchDiscordContext,
  resultTeam1: number,
  resultTeam2: number,
  statusShort: string,
): Promise<void> {
  if (!isDiscordEnvConfigured()) return

  const content = formatDiscordFinalMessage(
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
      channelKey: 'soccer',
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitDiscordFinal failed', { matchId: ctx.matchId, err })
  }
}

/** Never throws — no-ops when Discord env is absent. */
export async function tryEmitDiscordVoid(
  supabase: SupabaseClient,
  ctx: SoccerMatchDiscordContext,
  voidStatusShort: string,
): Promise<void> {
  if (!isDiscordEnvConfigured()) return

  const content = formatDiscordVoidMessage(ctx, voidStatusShort)

  try {
    await processDiscordEvent({
      supabase,
      matchId: ctx.matchId,
      eventType: 'void',
      channelKey: 'soccer',
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitDiscordVoid failed', { matchId: ctx.matchId, err })
  }
}

/** Never throws — no-ops when Discord env is absent. */
export async function tryEmitDiscordMatchReminder(
  supabase: SupabaseClient,
  ctx: SoccerMatchDiscordContext,
  kickoffAtIso: string,
): Promise<void> {
  if (!isDiscordEnvConfigured()) return

  let content: string
  try {
    content = formatDiscordMatchReminderMessage(ctx, kickoffAtIso)
  } catch {
    return
  }

  try {
    await processDiscordEvent({
      supabase,
      matchId: ctx.matchId,
      eventType: 'reminder',
      channelKey: 'soccer',
      payload: { content },
    })
  } catch (err) {
    console.error('tryEmitDiscordMatchReminder failed', {
      matchId: ctx.matchId,
      err,
    })
  }
}
