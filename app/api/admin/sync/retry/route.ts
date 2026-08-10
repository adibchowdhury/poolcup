import { NextResponse } from 'next/server'
import {
  requireAdminUser,
  SYNC_JOB_RETRY_TARGETS,
  type SyncJobRetryType,
} from '@/src/lib/admin-sync'
import { invokeCronRoute, resolveAppOrigin } from '@/src/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

type RetryBody = {
  jobType?: string
  eventId?: string | null
}

export async function POST(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: RetryBody = {}
  try {
    body = (await request.json()) as RetryBody
  } catch {
    body = {}
  }

  const jobType = body.jobType?.trim() as SyncJobRetryType | undefined
  const target = SYNC_JOB_RETRY_TARGETS.find((t) => t.jobType === jobType)
  if (!target) {
    return NextResponse.json({ error: 'Unknown jobType' }, { status: 400 })
  }

  const eventId = body.eventId?.trim() || null
  const searchParams =
    target.supportsEventId && eventId ? { event_id: eventId } : undefined

  const result = await invokeCronRoute(target.path, {
    origin: resolveAppOrigin(request),
    searchParams,
  })

  return NextResponse.json(
    {
      success: result.ok,
      status: result.status,
      jobType: target.jobType,
      eventId,
      body: result.body,
    },
    { status: result.ok ? 200 : 502 },
  )
}
