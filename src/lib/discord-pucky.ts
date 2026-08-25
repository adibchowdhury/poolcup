import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

const DISCORD_API_BASE = 'https://discord.com/api/v10/channels'

export type DiscordEventStatus = 'pending' | 'sent' | 'failed'

export type DiscordEventLogRow = {
  id: string
  match_id: string | null
  event_type: string
  channel_key: string
  payload: Record<string, unknown>
  status: DiscordEventStatus
  attempts: number
  last_error: string | null
  discord_message_id: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type EnqueueDiscordEventParams = {
  matchId?: string | null
  eventType: string
  channelKey?: string
  payload: Record<string, unknown>
  supabase?: SupabaseClient
}

export type ProcessDiscordEventResult = {
  row: DiscordEventLogRow | null
  created: boolean
  sent: boolean
}

function getAdminClient(supabase?: SupabaseClient): SupabaseClient {
  return supabase ?? createAdminSupabaseClient()
}

/** True when bot token and at least one mapped channel env are present. */
export function isDiscordEnvConfigured(): boolean {
  return !!process.env.DISCORD_BOT_TOKEN?.trim() && !!resolveChannelId('soccer')
}

function resolveChannelId(channelKey: string): string | null {
  const key = channelKey.trim().toLowerCase()
  if (key === 'soccer') {
    const id = process.env.DISCORD_CHANNEL_SOCCER?.trim()
    return id || null
  }
  return null
}

function channelConfigError(channelKey: string): string {
  if (!process.env.DISCORD_BOT_TOKEN?.trim()) {
    return 'DISCORD_BOT_TOKEN is not configured'
  }
  const channelId = resolveChannelId(channelKey)
  if (!channelId) {
    return `Unknown or unconfigured Discord channel key: ${channelKey}`
  }
  return 'Discord channel is not configured'
}

function rowFromDb(raw: Record<string, unknown>): DiscordEventLogRow {
  return {
    id: String(raw.id),
    match_id: raw.match_id == null ? null : String(raw.match_id),
    event_type: String(raw.event_type),
    channel_key: String(raw.channel_key),
    payload:
      raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
        ? (raw.payload as Record<string, unknown>)
        : {},
    status: raw.status as DiscordEventStatus,
    attempts: Number(raw.attempts ?? 0),
    last_error: raw.last_error == null ? null : String(raw.last_error),
    discord_message_id:
      raw.discord_message_id == null ? null : String(raw.discord_message_id),
    sent_at: raw.sent_at == null ? null : String(raw.sent_at),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  }
}

async function fetchExistingEvent(
  supabase: SupabaseClient,
  matchId: string | null,
  eventType: string,
  channelKey: string,
): Promise<DiscordEventLogRow | null> {
  let query = supabase
    .from('discord_event_log')
    .select('*')
    .eq('event_type', eventType)
    .eq('channel_key', channelKey)

  query =
    matchId == null
      ? query.is('match_id', null)
      : query.eq('match_id', matchId)

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error('fetchExistingEvent: select failed', {
      eventType,
      channelKey,
      message: error.message,
      code: error.code,
    })
    return null
  }

  return data ? rowFromDb(data as Record<string, unknown>) : null
}

/**
 * Idempotent enqueue — one row per (match_id, event_type, channel_key).
 * Returns whether a new row was inserted.
 */
export async function enqueueDiscordEvent(
  params: EnqueueDiscordEventParams,
): Promise<{ created: boolean; row: DiscordEventLogRow | null }> {
  const supabase = getAdminClient(params.supabase)
  const matchId = params.matchId ?? null
  const channelKey = params.channelKey?.trim() || 'soccer'

  try {
    const insertRow = {
      match_id: matchId,
      event_type: params.eventType,
      channel_key: channelKey,
      payload: params.payload,
      status: 'pending' as const,
    }

    const { data, error } = await supabase
      .from('discord_event_log')
      .upsert(insertRow, {
        onConflict: 'match_id,event_type,channel_key',
        ignoreDuplicates: true,
      })
      .select('*')
      .maybeSingle()

    if (error) {
      console.error('enqueueDiscordEvent: upsert failed', {
        eventType: params.eventType,
        channelKey,
        message: error.message,
        code: error.code,
      })
      return { created: false, row: null }
    }

    if (data) {
      return { created: true, row: rowFromDb(data as Record<string, unknown>) }
    }

    const existing = await fetchExistingEvent(
      supabase,
      matchId,
      params.eventType,
      channelKey,
    )
    return { created: false, row: existing }
  } catch (err) {
    console.error('enqueueDiscordEvent: unexpected error', {
      eventType: params.eventType,
      channelKey,
      err,
    })
    return { created: false, row: null }
  }
}

type DiscordSendResult =
  | { ok: true; messageId: string }
  | { ok: false; status: number; errorText: string }

async function postDiscordMessage(
  channelId: string,
  payload: Record<string, unknown>,
): Promise<DiscordSendResult> {
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim()
  if (!botToken) {
    return {
      ok: false,
      status: 0,
      errorText: 'DISCORD_BOT_TOKEN is not configured',
    }
  }

  try {
    const res = await fetch(`${DISCORD_API_BASE}/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = { message: 'Non-JSON response from Discord' }
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        errorText: JSON.stringify({ status: res.status, body }),
      }
    }

    const messageId =
      body &&
      typeof body === 'object' &&
      'id' in body &&
      typeof (body as { id: unknown }).id === 'string'
        ? (body as { id: string }).id
        : null

    if (!messageId) {
      return {
        ok: false,
        status: res.status,
        errorText: JSON.stringify({
          status: res.status,
          body,
          message: 'Discord response missing message id',
        }),
      }
    }

    return { ok: true, messageId }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      errorText: err instanceof Error ? err.message : String(err),
    }
  }
}

async function markEventFailed(
  supabase: SupabaseClient,
  row: DiscordEventLogRow,
  lastError: string,
): Promise<DiscordEventLogRow | null> {
  const { data, error } = await supabase
    .from('discord_event_log')
    .update({
      status: 'failed',
      attempts: row.attempts + 1,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('markEventFailed: update failed', {
      id: row.id,
      message: error.message,
      code: error.code,
    })
    return null
  }

  return data ? rowFromDb(data as Record<string, unknown>) : null
}

async function markEventSent(
  supabase: SupabaseClient,
  row: DiscordEventLogRow,
  discordMessageId: string,
): Promise<DiscordEventLogRow | null> {
  const sentAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('discord_event_log')
    .update({
      status: 'sent',
      discord_message_id: discordMessageId,
      sent_at: sentAt,
      last_error: null,
      updated_at: sentAt,
    })
    .eq('id', row.id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('markEventSent: update failed', {
      id: row.id,
      message: error.message,
      code: error.code,
    })
    return null
  }

  return data ? rowFromDb(data as Record<string, unknown>) : null
}

/**
 * Attempt delivery for a pending/failed outbox row.
 * Never throws — updates status in DB and returns the latest row.
 */
export async function sendPendingEvent(
  row: DiscordEventLogRow,
  supabase?: SupabaseClient,
): Promise<DiscordEventLogRow | null> {
  const client = getAdminClient(supabase)

  if (row.status === 'sent') {
    return row
  }

  if (!isDiscordEnvConfigured()) {
    return markEventFailed(client, row, 'Discord env is not configured')
  }

  const channelId = resolveChannelId(row.channel_key)
  if (!channelId) {
    return markEventFailed(client, row, channelConfigError(row.channel_key))
  }

  const result = await postDiscordMessage(channelId, row.payload)
  if (!result.ok) {
    return markEventFailed(client, row, result.errorText)
  }

  return markEventSent(client, row, result.messageId)
}

/** Enqueue then send when not already sent. Never throws. */
export async function processDiscordEvent(
  params: EnqueueDiscordEventParams,
): Promise<ProcessDiscordEventResult> {
  try {
    const supabase = getAdminClient(params.supabase)
    const { created, row } = await enqueueDiscordEvent(params)

    if (!row) {
      return { row: null, created: false, sent: false }
    }

    if (row.status === 'sent') {
      return { row, created, sent: false }
    }

    const afterSend = await sendPendingEvent(row, supabase)
    return {
      row: afterSend,
      created,
      sent: afterSend?.status === 'sent',
    }
  } catch (err) {
    console.error('processDiscordEvent: unexpected error', {
      eventType: params.eventType,
      channelKey: params.channelKey ?? 'soccer',
      err,
    })
    return { row: null, created: false, sent: false }
  }
}

/**
 * Re-attempt pending/failed rows (unscheduled — for future cron/admin use).
 * Never throws.
 */
export async function retryPendingDiscordEvents(
  limit = 25,
  supabase?: SupabaseClient,
): Promise<{ processed: number; sent: number; failed: number }> {
  const client = getAdminClient(supabase)
  const summary = { processed: 0, sent: 0, failed: 0 }

  try {
    const { data, error } = await client
      .from('discord_event_log')
      .select('*')
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('retryPendingDiscordEvents: select failed', {
        message: error.message,
        code: error.code,
      })
      return summary
    }

    for (const raw of data ?? []) {
      const row = rowFromDb(raw as Record<string, unknown>)
      summary.processed += 1
      const after = await sendPendingEvent(row, client)
      if (after?.status === 'sent') summary.sent += 1
      else summary.failed += 1
    }
  } catch (err) {
    console.error('retryPendingDiscordEvents: unexpected error', { err })
  }

  return summary
}
