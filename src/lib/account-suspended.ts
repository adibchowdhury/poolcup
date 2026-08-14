/** Cookie set when a banned user is signed out and sent to /suspended. */
export const SUSPENDED_COOKIE = 'poolcup_suspended'
export const SUSPENDED_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

export function isSuspendedPath(pathname: string): boolean {
  return pathname === '/suspended'
}
