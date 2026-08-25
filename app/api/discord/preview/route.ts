import { NextResponse } from 'next/server'
import { isCronAuthorized, requireCronSecretConfigured } from '@/src/lib/cron-auth'
import {
  formatDiscordFinalMessage,
  formatDiscordKickoffMessage,
  formatDiscordMatchReminderMessage,
  formatDiscordScoreChangeMessage,
  formatDiscordVoidMessage,
} from '@/src/lib/discord-soccer-events'
import {
  buildUsSportPreviewMessages,
  type DiscordUsSportKey,
} from '@/src/lib/discord-sport-messages'
import {
  DISCORD_CHANNEL_KEYS,
  isDiscordChannelKey,
  processDiscordEvent,
} from '@/src/lib/discord-pucky'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SEND_DELAY_MS = 500
const PREVIEW_START_OFFSET_MS = 45 * 60 * 1000

type PreviewResult = {
  event_type: string
  status: string | null
  discord_message_id: string | null
  last_error: string | null
}

type PreviewMessage = {
  eventType: string
  content: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildSoccerPreviewMessages(startAtIso: string): PreviewMessage[] {
  const laLigaFixture = {
    team1Name: 'Real Madrid',
    team2Name: 'Real Sociedad',
    eventName: 'La Liga 2026/27',
  }

  return [
    {
      eventType: 'preview_soccer_reminder',
      content: formatDiscordMatchReminderMessage(laLigaFixture, startAtIso),
    },
    {
      eventType: 'preview_soccer_kickoff',
      content: formatDiscordKickoffMessage(laLigaFixture),
    },
    {
      eventType: 'preview_soccer_score',
      content: formatDiscordScoreChangeMessage(
        laLigaFixture,
        { t1: 1, t2: 0 },
        23,
      ),
    },
    {
      eventType: 'preview_soccer_final',
      content: formatDiscordFinalMessage(laLigaFixture, 2, 1, 'FT'),
    },
    {
      eventType: 'preview_soccer_void',
      content: formatDiscordVoidMessage(
        {
          team1Name: 'Celta Vigo',
          team2Name: 'Osasuna',
        },
        'PST',
      ),
    },
  ]
}

function buildSportPreviewMessages(
  sport: DiscordUsSportKey,
  startAtIso: string,
): PreviewMessage[] {
  return buildUsSportPreviewMessages(sport, startAtIso).map(({ type, content }) => ({
    eventType: `preview_${sport}_${type}`,
    content,
  }))
}

async function sendPreviewMessage(
  channelKey: string,
  eventType: string,
  content: string,
): Promise<PreviewResult> {
  const supabase = createAdminSupabaseClient()
  const result = await processDiscordEvent({
    supabase,
    matchId: null,
    eventType,
    channelKey,
    payload: { content },
  })

  return {
    event_type: eventType,
    status: result.row?.status ?? null,
    discord_message_id: result.row?.discord_message_id ?? null,
    last_error: result.row?.last_error ?? null,
  }
}

async function parseSportFromBody(request: Request): Promise<string | NextResponse> {
  let sport = 'soccer'
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as { sport?: unknown }
      if (body.sport != null) {
        if (typeof body.sport !== 'string') {
          return NextResponse.json(
            { error: 'sport must be a string', validSports: [...DISCORD_CHANNEL_KEYS] },
            { status: 400 },
          )
        }
        sport = body.sport.trim().toLowerCase()
      }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
  }
  return sport
}

async function handlePreviewRequest(request: Request) {
  if (!requireCronSecretConfigured()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.DISCORD_BOT_TOKEN?.trim()) {
    return NextResponse.json(
      { error: 'DISCORD_BOT_TOKEN is not configured' },
      { status: 503 },
    )
  }

  const sportOrError = await parseSportFromBody(request)
  if (sportOrError instanceof NextResponse) {
    return sportOrError
  }

  const sport = sportOrError
  if (!isDiscordChannelKey(sport)) {
    return NextResponse.json(
      {
        error: `Unknown sport: ${sport}`,
        validSports: [...DISCORD_CHANNEL_KEYS],
      },
      { status: 400 },
    )
  }

  const startAtIso = new Date(Date.now() + PREVIEW_START_OFFSET_MS).toISOString()

  const previewMessages =
    sport === 'soccer'
      ? buildSoccerPreviewMessages(startAtIso)
      : buildSportPreviewMessages(sport, startAtIso)

  const results: PreviewResult[] = []

  for (let i = 0; i < previewMessages.length; i += 1) {
    if (i > 0) {
      await sleep(SEND_DELAY_MS)
    }
    const { eventType, content } = previewMessages[i]
    results.push(await sendPreviewMessage(sport, eventType, content))
  }

  return NextResponse.json({ sport, results })
}

export async function POST(request: Request) {
  try {
    return await handlePreviewRequest(request)
  } catch (error) {
    console.error('discord/preview error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
