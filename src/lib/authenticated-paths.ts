/**
 * Routes that use the authenticated app shell / bottom nav chrome.
 * Includes public-but-chrome paths like /join and /match — NOT an auth gate.
 *
 * Full-screen surfaces (no bottom nav): /onboarding, /create, /pool/* —
 * those stay protected via isProtectedAppPath but skip AuthenticatedChrome.
 */
export function isAuthenticatedAppPath(pathname: string): boolean {
  if (pathname === '/dashboard') return true
  if (pathname === '/discover') return true
  if (pathname === '/chat' || pathname.startsWith('/chat/')) return true
  if (pathname === '/friends' || pathname.startsWith('/friends/')) return true
  if (pathname === '/achievements') return true
  if (pathname === '/activity') return true
  if (pathname === '/history') return true
  if (pathname === '/analytics') return true
  if (pathname === '/history-performance') return true
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true
  if (pathname.startsWith('/join/')) return true
  if (pathname.startsWith('/match/')) return true
  return false
}

/**
 * Routes that require a logged-in session.
 * Logged-out visitors are redirected to /login?next=… (see proxy.ts).
 *
 * Intentionally public (not gated):
 * - /join/* (invite conversion)
 * - /match/* (public match hub)
 * - /u/* (public profiles)
 * - marketing, /login, /create-account, /auth/*, /coming-soon, /api/*
 */
export function isProtectedAppPath(pathname: string): boolean {
  if (pathname === '/dashboard') return true
  if (pathname === '/discover') return true
  if (pathname === '/chat' || pathname.startsWith('/chat/')) return true
  if (pathname === '/friends' || pathname.startsWith('/friends/')) return true
  if (pathname === '/create') return true
  if (pathname === '/achievements') return true
  if (pathname === '/activity') return true
  if (pathname === '/history') return true
  if (pathname === '/analytics') return true
  if (pathname === '/history-performance') return true
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
    return true
  }
  if (pathname.startsWith('/settings/')) return true
  if (pathname.startsWith('/pool/')) return true
  return false
}

export function isOnboardingPath(pathname: string): boolean {
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/')
}

/** Predict pages with a fixed bottom save bar — chrome sits above it. */
export function hasAuthenticatedBottomBar(pathname: string): boolean {
  return pathname.includes('/predict')
}
