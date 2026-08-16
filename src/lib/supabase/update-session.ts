import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isSuspendedPath,
  SUSPENDED_COOKIE,
  SUSPENDED_COOKIE_MAX_AGE_SECONDS,
} from '@/src/lib/account-suspended'
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

function setSuspendedCookie(response: NextResponse) {
  response.cookies.set({
    name: SUSPENDED_COOKIE,
    value: '1',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SUSPENDED_COOKIE_MAX_AGE_SECONDS,
  })
}

function clearSuspendedCookie(response: NextResponse) {
  response.cookies.set({
    name: SUSPENDED_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

/**
 * Refresh the Supabase auth session (cookie write-through) and:
 * - sign out banned users and redirect → /suspended
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
  const onSuspended = isSuspendedPath(pathname)
  const onOnboarding = isOnboardingPath(pathname)
  const hasSuspendedCookie =
    request.cookies.get(SUSPENDED_COOKIE)?.value === '1'

  // —— Ban gate (central choke point) ——
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('banned, onboarding_completed, is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!profileError && profile?.banned === true) {
      await supabase.auth.signOut()

      if (onSuspended) {
        setSuspendedCookie(supabaseResponse)
        return supabaseResponse
      }

      const suspendedUrl = request.nextUrl.clone()
      suspendedUrl.pathname = '/suspended'
      suspendedUrl.search = ''
      const redirectResponse = NextResponse.redirect(suspendedUrl)
      copyCookies(supabaseResponse, redirectResponse)
      setSuspendedCookie(redirectResponse)
      return redirectResponse
    }

    // Active (non-banned) session — clear any stale suspended cookie.
    if (hasSuspendedCookie) {
      clearSuspendedCookie(supabaseResponse)
    }

    // Non-banned users should not linger on /suspended.
    if (onSuspended) {
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = '/dashboard'
      homeUrl.search = ''
      const redirectResponse = NextResponse.redirect(homeUrl)
      copyCookies(supabaseResponse, redirectResponse)
      clearSuspendedCookie(redirectResponse)
      return redirectResponse
    }

    // Onboarding gate (protected routes only).
    if (isProtectedAppPath(pathname)) {
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
          // Allow admin / non-production design preview without resetting
          // onboarding_completed. Real completion gate still applies otherwise.
          const previewParam = request.nextUrl.searchParams.get('preview')
          const wantsPreview =
            previewParam === '1' || previewParam === 'true'
          const allowPreview =
            wantsPreview &&
            (profile?.is_admin === true ||
              process.env.NODE_ENV !== 'production')

          if (!allowPreview) {
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
    }

    return supabaseResponse
  }

  // —— Logged out ——
  if (onSuspended) {
    // Allowed only with the suspended cookie set at ban time.
    if (hasSuspendedCookie) {
      return supabaseResponse
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    const redirectResponse = NextResponse.redirect(loginUrl)
    copyCookies(supabaseResponse, redirectResponse)
    return redirectResponse
  }

  if (isProtectedAppPath(pathname)) {
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

  return supabaseResponse
}
