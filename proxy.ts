import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isStaleAuthSessionError } from '@/src/lib/auth-session'
import { resolveSafeRedirectPath } from '@/src/lib/safe-redirect'

/** Routes that require a signed-in user (explicit allowlist). */
function isProtectedPath(pathname: string): boolean {
  if (pathname === '/dashboard') return true
  if (pathname === '/create') return true
  if (pathname.startsWith('/pool/')) return true
  return false
}

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value)
  })
  return to
}

/** PostHog reverse proxy — rewrite with correct Host header (Vercel production). */
function rewritePostHogProxy(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/sideline')) {
    return null
  }

  const url = request.nextUrl.clone()
  const isAsset =
    url.pathname.startsWith('/sideline/static/') ||
    url.pathname.startsWith('/sideline/array/')
  const hostname = isAsset ? 'us-assets.i.posthog.com' : 'us.i.posthog.com'
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('host', hostname)
  url.protocol = 'https'
  url.hostname = hostname
  url.port = '443'
  url.pathname = url.pathname.replace(/^\/sideline/, '')
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
}

export async function proxy(request: NextRequest) {
  const posthogRewrite = rewritePostHogProxy(request)
  if (posthogRewrite) {
    return posthogRewrite
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  const forwardRequest = { headers: requestHeaders }

  let supabaseResponse = NextResponse.next({
    request: forwardRequest,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request: forwardRequest,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Do not run other logic between createServerClient and getUser().
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError && isStaleAuthSessionError(authError)) {
    await supabase.auth.signOut({ scope: 'local' })
  }

  if (user) {
    const { pathname } = request.nextUrl

    if (pathname === '/') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      redirectUrl.search = ''

      const redirectResponse = NextResponse.redirect(redirectUrl)
      return copyCookies(supabaseResponse, redirectResponse)
    }

    if (pathname === '/login') {
      const safeNext = resolveSafeRedirectPath(
        request.nextUrl.searchParams.get('next'),
      )
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = safeNext ?? '/dashboard'
      redirectUrl.search = ''

      const redirectResponse = NextResponse.redirect(redirectUrl)
      return copyCookies(supabaseResponse, redirectResponse)
    }
  }

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''

    const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const safeNext = resolveSafeRedirectPath(returnPath)
    if (safeNext) {
      loginUrl.searchParams.set('next', safeNext)
    }

    const redirectResponse = NextResponse.redirect(loginUrl)
    return copyCookies(supabaseResponse, redirectResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/sideline/:path*',
    /*
     * Match all request paths except:
     * - api routes (each route handles its own auth)
     * - _next/static, _next/image
     * - common static assets (favicon, images, etc.)
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
