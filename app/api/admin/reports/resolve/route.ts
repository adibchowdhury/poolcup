import { NextResponse } from 'next/server'
import { requireAdminService } from '@/src/lib/admin-console'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const REPORT_TYPES = new Set(['user', 'message', 'pool'])

export async function POST(request: Request) {
  const admin = await requireAdminService()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let reportType = ''
  let reportId = ''
  let note: string | null = null
  try {
    const body = (await request.json()) as {
      reportType?: string
      reportId?: string
      note?: string
    }
    reportType =
      typeof body.reportType === 'string' ? body.reportType.trim().toLowerCase() : ''
    reportId = typeof body.reportId === 'string' ? body.reportId.trim() : ''
    note =
      typeof body.note === 'string' && body.note.trim()
        ? body.note.trim().slice(0, 1000)
        : null
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!REPORT_TYPES.has(reportType)) {
    return NextResponse.json({ error: 'invalid_report_type' }, { status: 400 })
  }
  if (!reportId) {
    return NextResponse.json({ error: 'reportId_required' }, { status: 400 })
  }

  const { error } = await admin.service.rpc('admin_resolve_report', {
    p_admin_id: admin.userId,
    p_report_type: reportType,
    p_report_id: reportId,
    p_note: note,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not_admin') ? 403 : 400 },
    )
  }

  return NextResponse.json({ success: true })
}
