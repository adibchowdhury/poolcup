import { NextResponse } from 'next/server'
import {
  isReferralUuid,
  POOLCUP_REF_COOKIE,
  REFERRAL_SOURCE_INVITE_LINK,
} from '@/src/lib/referral'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  poolId?: string
  inviterId?: string | null
  source?: string | null
}

/**
 * Records pool join attribution (service_role RPC). Self-only for the joiner.
 */
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

  const cookieStore = await cookies()
  const cookieRef = cookieStore.get(POOLCUP_REF_COOKIE)?.value?.trim()
  const inviter =
    (isReferralUuid(body.inviterId) ? body.inviterId.trim() : null) ??
    (isReferralUuid(cookieRef) ? cookieRef : null)

  if (!inviter || inviter === user.id) {
    return NextResponse.json({ success: true, skipped: true })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.rpc('record_pool_join_attribution', {
    p_pool_id: poolId,
    p_joined_user_id: user.id,
    p_inviter_id: inviter,
    p_source: body.source?.trim() || REFERRAL_SOURCE_INVITE_LINK,
  })

  if (error) {
    console.error('record_pool_join_attribution failed', error.message)
    return NextResponse.json({ success: true, skipped: true })
  }

  return NextResponse.json({ success: true, inserted: Boolean(data) })
}
