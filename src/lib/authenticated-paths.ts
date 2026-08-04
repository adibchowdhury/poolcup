/** Routes that use the authenticated app shell (matches proxy allowlist + join flow). */
export function isAuthenticatedAppPath(pathname: string): boolean {
  if (pathname === '/dashboard') return true
  if (pathname === '/chat' || pathname.startsWith('/chat/')) return true
  if (pathname === '/friends') return true
  if (pathname === '/create') return true
  if (pathname.startsWith('/pool/')) return true
  if (pathname.startsWith('/join/')) return true
  if (pathname.startsWith('/match/')) return true
  return false
}

/** Predict pages with a fixed bottom save bar — chrome sits above it. */
export function hasAuthenticatedBottomBar(pathname: string): boolean {
  return pathname.includes('/predict')
}
