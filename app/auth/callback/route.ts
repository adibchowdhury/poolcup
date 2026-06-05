import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/dashboard'

  if (!next.startsWith('/')) {
    next = '/dashboard'
  }

  if (code) {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.email) {
        const firstName =
          typeof user.user_metadata?.first_name === 'string'
            ? user.user_metadata.first_name
            : 'there'

        void fetch(`${origin}/api/handle-new-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
          },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            firstName,
          }),
        }).catch((welcomeError) => {
          console.error('handle-new-user callback trigger failed:', welcomeError)
        })
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
