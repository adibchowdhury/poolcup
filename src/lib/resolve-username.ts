import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUsernameInput } from '@/src/lib/username'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when the path segment looks like a user UUID. */
export function isUserIdSlug(slug: string): boolean {
  return UUID_RE.test(slug.trim())
}

/**
 * Resolve a public username to user_id via `resolve_username(p_username)`.
 * Returns null when not found / invalid.
 */
export async function resolveUsernameToUserId(
  supabase: SupabaseClient,
  username: string,
): Promise<string | null> {
  const normalized = normalizeUsernameInput(username)
  if (!normalized) return null

  const { data, error } = await supabase.rpc('resolve_username', {
    p_username: normalized,
  })

  if (error) {
    console.error('resolve_username failed:', error.message)
    return null
  }

  return typeof data === 'string' && data.trim() ? data.trim() : null
}
