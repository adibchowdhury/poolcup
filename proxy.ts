import { NextResponse, type NextRequest } from 'next/server'
import {
  isReferralUuid,
  POOLCUP_REF_COOKIE,
  POOLCUP_REF_MAX_AGE_SECONDS,
} from '@/src/lib/referral'

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
 * First-touch attribution: set poolcup_ref from ?ref=<uuid> only when no valid
 * ref cookie exists yet. Captured even when the coming-soon gate rewrites.
 */
function getFirstTouchRefToSet(request: NextRequest): string | null {
  const raw = request.nextUrl.searchParams.get('ref')?.trim()
  if (!isReferralUuid(raw)) return null

  const existing = request.cookies.get(POOLCUP_REF_COOKIE)?.value?.trim()
  if (isReferralUuid(existing)) return null

  return raw
}

function applyRefCookie(
  response: NextResponse,
  ref: string | null,
): NextResponse {
  if (!ref) return response
  response.cookies.set({
    name: POOLCUP_REF_COOKIE,
    value: ref,
    // Readable client-side for the email signup path; server reads it too.
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: POOLCUP_REF_MAX_AGE_SECONDS,
  })
  return response
}

/**
 * Next.js 16 network boundary (formerly middleware.ts).
 * Always captures ?ref= (first-touch). Coming-soon gate is unchanged otherwise.
 */
export function proxy(request: NextRequest) {
  const refToSet = getFirstTouchRefToSet(request)

  // Gate off: still capture ref, otherwise pure passthrough.
  if (!isComingSoonEnabled()) {
    return applyRefCookie(NextResponse.next(), refToSet)
  }

  const bypassToken = getBypassToken()
  const { pathname, searchParams } = request.nextUrl

  // Always allow Next internals, APIs, static assets, and the holding page.
  if (isPassthroughPath(pathname)) {
    return applyRefCookie(NextResponse.next(), refToSet)
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
    return applyRefCookie(response, refToSet)
  }

  // Valid bypass cookie — full site access.
  if (bypassToken && hasValidBypassCookie(request, bypassToken)) {
    return applyRefCookie(NextResponse.next(), refToSet)
  }

  // Gate active: serve the coming-soon page for all user-facing routes.
  // Preserve referral cookie even though the rewrite drops the query string.
  const comingSoonUrl = request.nextUrl.clone()
  comingSoonUrl.pathname = '/coming-soon'
  comingSoonUrl.search = ''
  return applyRefCookie(NextResponse.rewrite(comingSoonUrl), refToSet)
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
