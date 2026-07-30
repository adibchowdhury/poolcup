import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  isLikelyNewAuthUser,
  isReferralUuid,
  POOLCUP_REF_COOKIE,
  REFERRAL_SOURCE_INVITE_LINK,
} from '@/src/lib/referral'
import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { secureCompare } from '@/src/lib/secure-compare'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  referredId?: string
}

function isInternalRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const internalSecret = process.env.INTERNAL_WEBHOOK_SECRET
  if (!internalSecret) return false
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null
  if (!bearerToken) return false
  return secureCompare(bearerToken, internalSecret)
}

/**
 * Best-effort referral recorder. Always returns success-shaped JSON so callers
 * never treat referral failure as an auth/signup failure.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const referredId = body.referredId?.trim()

    if (!isReferralUuid(referredId)) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const cookieStore = await cookies()
    const referrerRaw = cookieStore.get(POOLCUP_REF_COOKIE)?.value?.trim()
    if (!isReferralUuid(referrerRaw) || referrerRaw === referredId) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isSelf = user?.id === referredId
    const isInternal = isInternalRequest(request)

    if (!isSelf && !isInternal) {
      // Email confirmation / just-signed-up without session yet: allow only if
      // the auth user was created moments ago.
      const admin = createAdminSupabaseClient()
      const { data: authUser, error } = await admin.auth.admin.getUserById(
        referredId,
      )
      if (error || !isLikelyNewAuthUser(authUser.user?.created_at)) {
        return NextResponse.json({ success: true, skipped: true })
      }
    }

    const admin = createAdminSupabaseClient()
    await admin.rpc('record_referral', {
      p_referrer: referrerRaw,
      p_referred: referredId,
      p_source: REFERRAL_SOURCE_INVITE_LINK,
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set({
      name: POOLCUP_REF_COOKIE,
      value: '',
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
    })
    return response
  } catch (error) {
    console.error('record-referral best-effort failed:', error)
    return NextResponse.json({ success: true, skipped: true })
  }
}
