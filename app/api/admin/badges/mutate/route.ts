import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/src/lib/admin-sync'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  action?: 'award' | 'revoke'
  userId?: string
  achievementId?: string
}

export async function POST(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const action = body.action
  const userId = body.userId?.trim()
  const achievementId = body.achievementId?.trim()
  if (
    (action !== 'award' && action !== 'revoke') ||
    !userId ||
    !achievementId
  ) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const service = createAdminSupabaseClient()
  const rpcName =
    action === 'award' ? 'admin_award_badge' : 'admin_revoke_badge'

  const { data, error } = await service.rpc(rpcName, {
    p_admin_id: admin.userId,
    p_user_id: userId,
    p_achievement_id: achievementId,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('not authorized') ? 403 : 400 },
    )
  }

  return NextResponse.json({
    success: true,
    action,
    achievementId: data ?? achievementId,
  })
}
