import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isOnboardingPath,
  isProtectedAppPath,
} from '@/src/lib/authenticated-paths'
import { resolveSafeRedirectPath } from '@/src/lib/safe-redirect'

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value)
  })
}

/**
 * Refresh the Supabase auth session (cookie write-through) and:
 * - redirect unauthenticated visitors away from protected routes → /login
 * - redirect incomplete onboarding → /onboarding
 * - redirect completed users away from /onboarding → /dashboard (or next)
 */
export async function updateSessionAndGateAuth(
  request: NextRequest,
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const onOnboarding = isOnboardingPath(pathname)

  if (!user && isProtectedAppPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''

    const nextCandidate = `${pathname}${request.nextUrl.search}`
    const safeNext = resolveSafeRedirectPath(nextCandidate) ?? pathname
    if (safeNext !== '/login' && !safeNext.startsWith('/login?')) {
      loginUrl.searchParams.set('next', safeNext)
    }

    const redirectResponse = NextResponse.redirect(loginUrl)
    copyCookies(supabaseResponse, redirectResponse)
    return redirectResponse
  }

  if (user && isProtectedAppPath(pathname)) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()

    // Fail open if column/query missing — avoid locking the whole app.
    if (!profileError) {
      const incomplete = profile?.onboarding_completed !== true

      if (incomplete && !onOnboarding) {
        const onboardingUrl = request.nextUrl.clone()
        onboardingUrl.pathname = '/onboarding'
        onboardingUrl.search = ''
        const nextCandidate = `${pathname}${request.nextUrl.search}`
        const safeNext = resolveSafeRedirectPath(nextCandidate)
        if (
          safeNext &&
          safeNext !== '/onboarding' &&
          !safeNext.startsWith('/onboarding')
        ) {
          onboardingUrl.searchParams.set('next', safeNext)
        }
        const redirectResponse = NextResponse.redirect(onboardingUrl)
        copyCookies(supabaseResponse, redirectResponse)
        return redirectResponse
      }

      if (!incomplete && onOnboarding) {
        const doneUrl = request.nextUrl.clone()
        const nextParam = request.nextUrl.searchParams.get('next')
        const safeNext = resolveSafeRedirectPath(nextParam)
        doneUrl.pathname = safeNext ?? '/dashboard'
        doneUrl.search = ''
        const redirectResponse = NextResponse.redirect(doneUrl)
        copyCookies(supabaseResponse, redirectResponse)
        return redirectResponse
      }
    }
  }

  return supabaseResponse
}
