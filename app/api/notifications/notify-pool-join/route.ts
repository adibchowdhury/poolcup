import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { tryCreateNotification } from '@/src/lib/notify-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  poolId?: string
  inviteCode?: string
  poolName?: string
}

/** Notify the signed-in user that they joined a pool (pool_invite category). */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const poolId = body.poolId?.trim()
  if (!poolId) {
    return NextResponse.json({ error: 'missing_pool' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { data: pool } = await admin
    .from('pools')
    .select('id, name, invite_code')
    .eq('id', poolId)
    .maybeSingle()

  if (!pool) {
    return NextResponse.json({ error: 'pool_not_found' }, { status: 404 })
  }

  const inviteCode =
    body.inviteCode?.trim() || pool.invite_code || poolId
  const name = body.poolName?.trim() || pool.name || 'a pool'

  await tryCreateNotification(
    admin,
    {
      userId: user.id,
      category: 'pool_invite',
      title: `Welcome to ${name}`,
      body: "You're in — make your predictions.",
      data: {
        href: `/pool/${inviteCode}`,
        pool_id: pool.id,
      },
    },
    'notify-pool-join',
  )

  return NextResponse.json({ success: true })
}
