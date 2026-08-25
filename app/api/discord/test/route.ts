import { NextResponse } from 'next/server'
import { isCronAuthorized, requireCronSecretConfigured } from '@/src/lib/cron-auth'
import { processDiscordEvent } from '@/src/lib/discord-pucky'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OUTBOX_TEST_CONTENT = '🧪 Pucky outbox test'

export async function POST(request: Request) {
  if (!requireCronSecretConfigured()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { row, created, sent } = await processDiscordEvent({
    matchId: null,
    eventType: 'outbox_test',
    channelKey: 'soccer',
    payload: { content: OUTBOX_TEST_CONTENT },
  })

  if (!row) {
    return NextResponse.json(
      { ok: false, error: 'Failed to enqueue or load discord_event_log row' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: row.status === 'sent',
    created,
    sent,
    row: {
      id: row.id,
      status: row.status,
      attempts: row.attempts,
      discord_message_id: row.discord_message_id,
      last_error: row.last_error,
    },
  })
}
