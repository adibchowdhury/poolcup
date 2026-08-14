import { NextResponse } from 'next/server'
import type { AdminFailedWebhookRow } from '@/src/lib/admin-console'
import { requireAdminService } from '@/src/lib/admin-console'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const admin = await requireAdminService()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const limitRaw = Number(
    new URL(request.url).searchParams.get('limit') ?? '50',
  )
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 200)
    : 50

  const { data, error } = await admin.service.rpc('admin_failed_webhooks', {
    p_admin_id: admin.userId,
    p_limit: limit,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not_admin') ? 403 : 500 },
    )
  }

  return NextResponse.json({
    events: (data ?? []) as AdminFailedWebhookRow[],
  })
}
