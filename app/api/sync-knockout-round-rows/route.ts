import { NextResponse } from 'next/server'
import { sendOpsNtfy } from '@/src/lib/notify-ops'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { secureCompare } from '@/src/lib/secure-compare'
import {
  syncKnockoutRoundRows,
  type KnockoutRoundRowWouldCreate,
} from '@/src/lib/sync-knockout-round-rows'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null
  if (bearerToken && secureCompare(bearerToken, cronSecret)) return true

  const cronHeader = request.headers.get('x-cron-secret')
  if (cronHeader && secureCompare(cronHeader, cronSecret)) return true

  return false
}

function collectCreated(
  rounds: Awaited<ReturnType<typeof syncKnockoutRoundRows>>['rounds'],
): KnockoutRoundRowWouldCreate[] {
  const created: KnockoutRoundRowWouldCreate[] = []
  for (const round of rounds) {
    created.push(...round.created)
  }
  return created
}

async function runSyncKnockoutRoundRowsJob(): Promise<{
  summary: Awaited<ReturnType<typeof syncKnockoutRoundRows>>
  ntfySent: boolean
}> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured')
  }

  const supabase = createAdminSupabaseClient()

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

  return { summary, ntfySent }
}

async function handleRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { summary, ntfySent } = await runSyncKnockoutRoundRowsJob()
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
