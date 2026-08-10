import { NextResponse, type NextRequest } from 'next/server'
import {
  isReferralUuid,
  POOLCUP_REF_COOKIE,
  POOLCUP_REF_MAX_AGE_SECONDS,
} from '@/src/lib/referral'
import { updateSessionAndGateAuth } from '@/src/lib/supabase/update-session'

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

/** Always open when the gate is on (holding page, APIs, assets). */
function isPassthroughPath(pathname: string): boolean {
  if (pathname === '/coming-soon') return true
  if (pathname.startsWith('/api/')) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname === '/favicon.ico') return true
  if (pathname === '/icon.svg') return true
  if (pathname === '/robots.txt') return true
  if (pathname === '/sitemap.xml') return true
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
 * Public marketing pages stay reachable when COMING_SOON_MODE=on.
 * Auth + app routes are rewritten to /coming-soon (product closed).
 */
function isMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true
  const marketing = new Set([
    '/pricing',
    '/terms',
    '/privacy',
    '/security',
    '/cookies',
    '/contact',
  ])
  return marketing.has(pathname)
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
 *
 * Order:
 * 1) First-touch ?ref=
 * 2) Passthrough (API, assets, /coming-soon)
 * 3) Coming-soon product gate (when on) — rewrite unless marketing/bypass
 * 4) Supabase session refresh + auth gate for protected app routes
 *
 * Coming-soon is an environment product lock; auth is a session lock.
 * Auth never runs for traffic rewritten to /coming-soon.
 */
export async function proxy(request: NextRequest) {
  const refToSet = getFirstTouchRefToSet(request)
  const { pathname, searchParams } = request.nextUrl

  // Always allow Next internals, APIs, static assets, and the holding page.
  if (isPassthroughPath(pathname)) {
    return applyRefCookie(NextResponse.next(), refToSet)
  }

  // —— Coming-soon gate (product closed) ——
  if (isComingSoonEnabled()) {
    const bypassToken = getBypassToken()

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

    const hasBypass =
      Boolean(bypassToken) && hasValidBypassCookie(request, bypassToken!)

    // Soft launch: landing + legal/marketing pages stay public (no auth gate).
    if (!hasBypass && isMarketingPath(pathname)) {
      return applyRefCookie(NextResponse.next(), refToSet)
    }

    // No bypass → holding page for everything else (including /login, /dashboard).
    if (!hasBypass) {
      const comingSoonUrl = request.nextUrl.clone()
      comingSoonUrl.pathname = '/coming-soon'
      comingSoonUrl.search = ''
      return applyRefCookie(NextResponse.rewrite(comingSoonUrl), refToSet)
    }

    // Valid bypass — fall through to session refresh + auth gate.
  }

  // —— Session refresh + auth gate (product open or coming-soon bypassed) ——
  const sessionResponse = await updateSessionAndGateAuth(request)
  return applyRefCookie(sessionResponse, refToSet)
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
