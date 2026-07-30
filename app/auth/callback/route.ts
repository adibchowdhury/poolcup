import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { getSafeRedirectPath } from '@/src/lib/safe-redirect'
import { isLikelyNewAuthUser } from '@/src/lib/referral'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = getSafeRedirectPath(searchParams.get('next'))

  if (code) {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        void fetch(`${origin}/api/handle-new-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.INTERNAL_WEBHOOK_SECRET
              ? {
                  Authorization: `Bearer ${process.env.INTERNAL_WEBHOOK_SECRET}`,
                }
              : {}),
          },
          body: JSON.stringify({ userId: user.id }),
        }).catch((welcomeError) => {
          console.error('handle-new-user callback trigger failed:', welcomeError)
        })

        // Referral: NEW Google accounts only (created_at within ~5 min).
        // Returning logins skip this. UNIQUE(referred_id) is the ultimate guard.
        // Best-effort — never await; never block redirect.
        if (isLikelyNewAuthUser(user.created_at)) {
          const cookieHeader = request.headers.get('cookie')
          void fetch(`${origin}/api/record-referral`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
              ...(process.env.INTERNAL_WEBHOOK_SECRET
                ? {
                    Authorization: `Bearer ${process.env.INTERNAL_WEBHOOK_SECRET}`,
                  }
                : {}),
            },
            body: JSON.stringify({ referredId: user.id }),
          }).catch(() => {
            /* best-effort — never surface */
          })
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
