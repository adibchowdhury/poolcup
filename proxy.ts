import { NextResponse, type NextRequest } from 'next/server'

const COOKIE_NAME = 'poolcup_preview'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 // 1 year

function isComingSoonEnabled(): boolean {
  return process.env.COMING_SOON_MODE === 'on'
}

function getBypassToken(): string | undefined {
  const token = process.env.COMING_SOON_BYPASS_TOKEN?.trim()
  return token || undefined
}

function hasValidBypassCookie(request: NextRequest, token: string): boolean {
  return request.cookies.get(COOKIE_NAME)?.value === token
}

function isPassthroughPath(pathname: string): boolean {
  if (pathname === '/coming-soon') return true
  if (pathname.startsWith('/api/')) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname === '/favicon.ico') return true
  if (pathname === '/icon.svg') return true
  if (pathname === '/robots.txt') return true
  if (pathname === '/sitemap.xml') return true
  // Static files in /public
  if (
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?|ttf|eot)$/i.test(
      pathname,
    )
  ) {
    return true
  }
  return false
}

/**
 * Next.js 16 network boundary (formerly middleware.ts).
 * When COMING_SOON_MODE is not exactly 'on', this is a pure no-op.
 */
export function proxy(request: NextRequest) {
  // Zero behavior change when gate is off or unset.
  if (!isComingSoonEnabled()) {
    return NextResponse.next()
  }

  const bypassToken = getBypassToken()
  const { pathname, searchParams } = request.nextUrl

  // Always allow Next internals, APIs, static assets, and the holding page.
  if (isPassthroughPath(pathname)) {
    return NextResponse.next()
  }

  // ?preview=<token> — set cookie and redirect to a clean URL (no token in bar).
  const previewParam = searchParams.get('preview')
  if (bypassToken && previewParam && previewParam === bypassToken) {
    const cleanUrl = request.nextUrl.clone()
    cleanUrl.searchParams.delete('preview')

    const response = NextResponse.redirect(cleanUrl)
    response.cookies.set({
      name: COOKIE_NAME,
      value: bypassToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })
    return response
  }

  // Valid bypass cookie — full site access.
  if (bypassToken && hasValidBypassCookie(request, bypassToken)) {
    return NextResponse.next()
  }

  // Gate active: serve the coming-soon page for all user-facing routes.
  const comingSoonUrl = request.nextUrl.clone()
  comingSoonUrl.pathname = '/coming-soon'
  comingSoonUrl.search = ''
  return NextResponse.rewrite(comingSoonUrl)
}

export const config = {
  matcher: [
    /*
     * Run on all paths except Next static/image optimization chunks.
     * Further skips (API, assets, /coming-soon) are handled in proxy().
     */
    '/((?!_next/static|_next/image).*)',
  ],
}
