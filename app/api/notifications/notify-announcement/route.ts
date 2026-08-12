import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { tryCreateNotification } from '@/src/lib/notify-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  poolId?: string
  announcementId?: string
  message?: string
}

/** Fan-out announcement notifications to pool members (except author). */
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
    .select('id, name, invite_code, creator_id')
    .eq('id', poolId)
    .maybeSingle()

  if (!pool) {
    return NextResponse.json({ error: 'pool_not_found' }, { status: 404 })
  }

  if (pool.creator_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: members } = await admin
    .from('pool_members')
    .select('user_id')
    .eq('pool_id', poolId)

  const message = (body.message ?? '').trim().slice(0, 200)
  const href = `/pool/${pool.invite_code || poolId}`
  const title = `${pool.name ?? 'Pool'} announcement`
  const bodyText = message || 'New announcement from the pool host.'

  let notified = 0
  for (const row of members ?? []) {
    const userId = row.user_id as string | null
    if (!userId || userId === user.id) continue
    const id = await tryCreateNotification(
      admin,
      {
        userId,
        category: 'announcement',
        title,
        body: bodyText,
        data: {
          href,
          pool_id: poolId,
          announcement_id: body.announcementId ?? null,
        },
      },
      'notify-announcement',
    )
    if (id) notified += 1
  }

  return NextResponse.json({ success: true, notified })
}
