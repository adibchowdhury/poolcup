import { NextResponse } from 'next/server'
import type {
  AdminReportQueueRow,
  AdminReportStatusFilter,
  AdminReportTypeFilter,
} from '@/src/lib/admin-console'
import { requireAdminService } from '@/src/lib/admin-console'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STATUS_VALUES = new Set<AdminReportStatusFilter>([
  'open',
  'resolved',
  'all',
])
const TYPE_VALUES = new Set<AdminReportTypeFilter>([
  'all',
  'user',
  'message',
  'pool',
])

export async function GET(request: Request) {
  const admin = await requireAdminService()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = new URL(request.url).searchParams
  const statusRaw = (params.get('status') ?? 'open').trim().toLowerCase()
  const typeRaw = (params.get('type') ?? 'all').trim().toLowerCase()
  const status = STATUS_VALUES.has(statusRaw as AdminReportStatusFilter)
    ? (statusRaw as AdminReportStatusFilter)
    : 'open'
  const type = TYPE_VALUES.has(typeRaw as AdminReportTypeFilter)
    ? (typeRaw as AdminReportTypeFilter)
    : 'all'

  const limitRaw = Number(params.get('limit') ?? '100')
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 200)
    : 100

  const { data, error } = await admin.service.rpc('admin_get_report_queue', {
    p_admin_id: admin.userId,
    p_status: status,
    p_type: type,
    p_limit: limit,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not_admin') ? 403 : 500 },
    )
  }

  return NextResponse.json({
    reports: (data ?? []) as AdminReportQueueRow[],
  })
}
