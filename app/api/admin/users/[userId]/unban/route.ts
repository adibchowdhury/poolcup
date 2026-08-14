import { NextResponse } from 'next/server'
import { requireAdminService } from '@/src/lib/admin-console'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ userId: string }> }

export async function POST(_request: Request, context: Ctx) {
  const admin = await requireAdminService()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: 'userId_required' }, { status: 400 })
  }

  const { error } = await admin.service.rpc('admin_unban_user', {
    p_admin_id: admin.userId,
    p_target_user_id: userId,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not_admin') ? 403 : 400 },
    )
  }

  return NextResponse.json({ success: true })
}
