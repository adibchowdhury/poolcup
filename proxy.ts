import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
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

export async function proxy(request: NextRequest) {
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
  } = await supabase.auth.getUser()

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
    /*
     * Match all request paths except:
     * - api routes (each route handles its own auth)
     * - _next/static, _next/image
     * - common static assets (favicon, images, etc.)
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
