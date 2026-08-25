import { NextResponse } from 'next/server'
import { isCronAuthorized, requireCronSecretConfigured } from '@/src/lib/cron-auth'
import { retryPendingDiscordEvents } from '@/src/lib/discord-pucky'
import {
  resolveEventName,
  tryEmitDiscordMatchReminder,
} from '@/src/lib/discord-soccer-events'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { withSyncJob } from '@/src/lib/sync-jobs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/** Slightly over one hour so hourly cron overlap still catches the window. */
const REMINDER_HORIZON_MS = 65 * 60 * 1000
const RETRY_BATCH_SIZE = 10

type MatchRow = {
  id: string
  event_id: string | null
  team1_name: string
  team2_name: string
  kickoff_at: string
}

async function handleDiscordMatchReminders(request: Request) {
  if (!requireCronSecretConfigured()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()

  try {
    const summary = await withSyncJob(
      admin,
      { jobType: 'discord_match_reminders' },
      async () => {
        const retried = await retryPendingDiscordEvents(RETRY_BATCH_SIZE, admin)

        const now = Date.now()
        const nowIso = new Date(now).toISOString()
        const horizonIso = new Date(now + REMINDER_HORIZON_MS).toISOString()

        const { data: events, error: eventsError } = await admin
          .from('sporting_events')
          .select('id, name')
          .eq('provider', 'api-football')
          .in('status', ['live', 'upcoming'])

        if (eventsError) throw new Error(eventsError.message)

        const eventIds = (events ?? []).map((row) => String(row.id))
        const eventNameById = new Map(
          (events ?? []).map((row) => [String(row.id), String(row.name)]),
        )

        if (eventIds.length === 0) {
          return {
            itemsProcessed: retried.processed,
            itemsChanged: retried.sent,
            detail: { retried, remindersAttempted: 0 },
            result: { retried, remindersAttempted: 0 },
          }
        }

        const { data: matches, error: matchError } = await admin
          .from('matches')
          .select('id, event_id, team1_name, team2_name, kickoff_at')
          .in('event_id', eventIds)
          .eq('is_final', false)
          .gt('kickoff_at', nowIso)
          .lte('kickoff_at', horizonIso)

        if (matchError) throw new Error(matchError.message)

        const upcoming = (matches ?? []) as MatchRow[]

        for (const match of upcoming) {
          await tryEmitDiscordMatchReminder(
            admin,
            {
              matchId: match.id,
              team1Name: match.team1_name,
              team2Name: match.team2_name,
              eventName: resolveEventName(eventNameById, match.event_id),
            },
            match.kickoff_at,
          )
        }

        return {
          itemsProcessed: upcoming.length + retried.processed,
          itemsChanged: upcoming.length + retried.sent,
          detail: {
            retried,
            remindersAttempted: upcoming.length,
          },
          result: {
            retried,
            remindersAttempted: upcoming.length,
          },
        }
      },
    )

    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('discord-match-reminders error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleDiscordMatchReminders(request)
}

export async function POST(request: Request) {
  return handleDiscordMatchReminders(request)
}
