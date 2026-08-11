import { normalizeUsernameInput } from '@/src/lib/username'

/**
 * Canonical public profile URL.
 * Prefer `/u/{username}` when known; fall back to `/u/{userId}` (page redirects).
 */
export function hrefForUser(
  userId: string,
  username?: string | null,
): string {
  const handle = username?.trim()
    ? normalizeUsernameInput(username)
    : null
  if (handle) return `/u/${handle}`
  return `/u/${userId}`
}
