import { NextResponse } from 'next/server'
import { requireAdminService } from '@/src/lib/admin-console'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ userId: string }> }

export async function GET(_request: Request, context: Ctx) {
  const admin = await requireAdminService()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: 'userId_required' }, { status: 400 })
  }

  const { data, error } = await admin.service.rpc('admin_user_detail', {
    p_admin_id: admin.userId,
    p_user_id: userId,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not_admin') ? 403 : 500 },
    )
  }

  return NextResponse.json({ detail: data })
}
