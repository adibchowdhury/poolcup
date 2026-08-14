import { NextResponse } from 'next/server'
import { requireAdminService } from '@/src/lib/admin-console'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ poolId: string }> }

export async function POST(_request: Request, context: Ctx) {
  const admin = await requireAdminService()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { poolId } = await context.params
  if (!poolId) {
    return NextResponse.json({ error: 'poolId_required' }, { status: 400 })
  }

  const { error } = await admin.service.rpc('admin_close_pool', {
    p_admin_id: admin.userId,
    p_pool_id: poolId,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not_admin') ? 403 : 400 },
    )
  }

  return NextResponse.json({ success: true })
}
