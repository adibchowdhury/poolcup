import { NextResponse } from 'next/server'
import { requireAdminService } from '@/src/lib/admin-console'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ matchId: string }> }

export async function POST(_request: Request, context: Ctx) {
  const admin = await requireAdminService()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { matchId } = await context.params
  if (!matchId) {
    return NextResponse.json({ error: 'matchId_required' }, { status: 400 })
  }

  const { error } = await admin.service.rpc('admin_refresh_match_scoring', {
    p_admin_id: admin.userId,
    p_match_id: matchId,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not_admin') ? 403 : 400 },
    )
  }

  return NextResponse.json({ success: true })
}
