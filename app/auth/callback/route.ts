import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { getSafeRedirectPath } from '@/src/lib/safe-redirect'
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
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
