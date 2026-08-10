import { NextResponse } from 'next/server'
import { CURRENT_EVENT_SLUG } from '@/src/lib/current-event'
import { isCronAuthorized, requireCronSecretConfigured } from '@/src/lib/cron-auth'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { withSyncJob } from '@/src/lib/sync-jobs'
import {
  syncKnockoutRoundRows,
  type KnockoutRoundRowWouldCreate,
} from '@/src/lib/sync-knockout-round-rows'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ACTIVE_EVENT_STATUSES = new Set(['live', 'upcoming'])

function collectCreated(
  rounds: Awaited<ReturnType<typeof syncKnockoutRoundRows>>['rounds'],
): KnockoutRoundRowWouldCreate[] {
  const created: KnockoutRoundRowWouldCreate[] = []
  for (const round of rounds) {
    created.push(...round.created)
  }
  return created
}

async function runSyncKnockoutRoundRowsJob(): Promise<
  | {
      summary: Awaited<ReturnType<typeof syncKnockoutRoundRows>>
      ntfySent: boolean
      eventId: string | null
    }
  | {
      skipped: 'wc_not_active'
      eventStatus: string | null
      eventId: string | null
    }
> {
  const supabase = createAdminSupabaseClient()
  const { data: worldCupEvent, error: eventError } = await supabase
    .from('sporting_events')
    .select('id, status')
    .eq('slug', CURRENT_EVENT_SLUG)
    .maybeSingle()

  if (eventError) {
    throw new Error(`Failed to load World Cup event status: ${eventError.message}`)
  }

  const eventId =
    typeof worldCupEvent?.id === 'string' ? worldCupEvent.id : null
  const eventStatus =
    typeof worldCupEvent?.status === 'string'
      ? worldCupEvent.status.trim().toLowerCase()
      : null

  if (!eventStatus || !ACTIVE_EVENT_STATUSES.has(eventStatus)) {
    return { skipped: 'wc_not_active', eventStatus, eventId }
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured')
  }

  const summary = await syncKnockoutRoundRows({
    dryRun: false,
    apiKey,
    supabase,
  })

  let ntfySent = false
  if (summary.needs_attention.length > 0) {
    try {
      await sendOpsNtfy(
        `sync-knockout-round-rows: ${summary.needs_attention.length} item(s) need attention: ${summary.needs_attention.join(' | ')}`,
      )
      ntfySent = true
    } catch (notifyError) {
      console.error('sync-knockout-round-rows: ops ntfy failed', notifyError)
    }
  }

  return { summary, ntfySent, eventId }
}

async function handleRequest(request: Request) {
  if (!requireCronSecretConfigured()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()
  const { data: worldCupEvent } = await supabase
    .from('sporting_events')
    .select('id')
    .eq('slug', CURRENT_EVENT_SLUG)
    .maybeSingle()
  const eventId =
    typeof worldCupEvent?.id === 'string' ? worldCupEvent.id : null

  try {
    type JobResult =
      | {
          skipped: 'wc_not_active'
          eventStatus: string | null
          eventId: string | null
        }
      | {
          summary: Awaited<ReturnType<typeof syncKnockoutRoundRows>>
          ntfySent: boolean
          eventId: string | null
        }

    const wrapped = await withSyncJob<JobResult>(
      supabase,
      {
        jobType: 'sync_knockout_round_rows',
        eventId,
      },
      async () => {
        const result = await runSyncKnockoutRoundRowsJob()

        if ('skipped' in result) {
          return {
            itemsProcessed: 0,
            itemsChanged: 0,
            detail: {
              skipped: result.skipped,
              event_status: result.eventStatus,
              event_id: result.eventId,
            },
            result,
          }
        }

        const createdCount = collectCreated(result.summary.rounds).length
        return {
          itemsProcessed: createdCount + result.summary.needs_attention.length,
          itemsChanged: createdCount,
          partial: result.summary.needs_attention.length > 0,
          detail: {
            created_count: createdCount,
            needs_attention: result.summary.needs_attention.length,
            ntfy_sent: result.ntfySent,
            event_id: result.eventId,
          },
          result,
        }
      },
    )

    if ('skipped' in wrapped) {
      return NextResponse.json({
        success: true,
        skipped: wrapped.skipped,
        event_status: wrapped.eventStatus,
      })
    }

    const { summary, ntfySent } = wrapped
    const createdCount = collectCreated(summary.rounds).length

    return NextResponse.json({
      success: true,
      created_count: createdCount,
      ntfy_sent: ntfySent,
      ...summary,
    })
  } catch (error) {
    console.error('sync-knockout-round-rows error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'

    try {
      await sendOpsNtfy(`sync-knockout-round-rows failed: ${message}`)
    } catch (notifyError) {
      console.error('sync-knockout-round-rows: ops ntfy failed', notifyError)
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}
