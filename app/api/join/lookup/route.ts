import { NextResponse } from 'next/server'
import {
  checkDbRateLimit,
  getClientIp,
  INVITE_ATTEMPT_MAX,
  INVITE_ATTEMPT_WINDOW_SEC,
  INVITE_RATE_LIMIT_MESSAGE,
} from '@/src/lib/rate-limit'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Rate-limited invite-code lookup for the join flow.
 * Always records an attempt before revealing validity.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const code = (params.get('code') ?? '').trim()

  if (!code || code.length > 64) {
    return NextResponse.json(
      { error: 'invalid_code', message: 'This pool is not available' },
      { status: 400 },
    )
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const subject = user?.id ? `user:${user.id}` : `ip:${getClientIp(request)}`
  const admin = createAdminSupabaseClient()

  const allowed = await checkDbRateLimit(admin, {
    action: 'invite_attempt',
    subject,
    max: INVITE_ATTEMPT_MAX,
    windowSeconds: INVITE_ATTEMPT_WINDOW_SEC,
  })

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: INVITE_RATE_LIMIT_MESSAGE,
      },
      { status: 429 },
    )
  }

  const { data: pool, error } = await admin
    .from('pools')
    .select(
      'id, name, invite_code, creator_id, created_at, accepting_members',
    )
    .eq('invite_code', code)
    .maybeSingle()

  if (error) {
    console.error('join lookup failed:', error.message)
    return NextResponse.json(
      { error: 'lookup_failed', message: 'This pool is not available' },
      { status: 500 },
    )
  }

  if (!pool) {
    // Same generic copy as the join page "unavailable" state — no code validity leak.
    return NextResponse.json(
      { error: 'not_found', message: 'This pool is not available' },
      { status: 404 },
    )
  }

  const { data: members, error: membersError } = await admin
    .from('pool_members')
    .select('id, user_id, display_name')
    .eq('pool_id', pool.id)
    .order('display_name')

  if (membersError) {
    console.error('join lookup members failed:', membersError.message)
  }

  return NextResponse.json({
    pool,
    members: members ?? [],
  })
}
