import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSportsUsernameCandidate } from '@/src/lib/sports-username'

/** User-facing username rules (input): 2–32, a-z / 0-9 / underscore, forced lowercase. */
const USERNAME_INPUT_PATTERN = /^[a-z0-9_]{2,32}$/

export const USERNAME_RULES_HINT =
  '2–32 characters: lowercase letters, numbers, and underscores only.'

export function normalizeUsernameInput(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isUsernameFormatValid(username: string): boolean {
  return USERNAME_INPUT_PATTERN.test(username)
}

export type UsernameFormatError = 'empty' | 'too_short' | 'too_long' | 'invalid_chars'

export function getUsernameFormatError(
  username: string,
): UsernameFormatError | null {
  if (!username) return 'empty'
  if (username.length < 2) return 'too_short'
  if (username.length > 32) return 'too_long'
  if (!USERNAME_INPUT_PATTERN.test(username)) return 'invalid_chars'
  return null
}

export function usernameFormatErrorMessage(
  error: UsernameFormatError | null,
): string | null {
  if (!error) return null
  if (error === 'empty') return 'Enter a username.'
  if (error === 'too_short') return 'Username must be at least 2 characters.'
  if (error === 'too_long') return 'Username must be at most 32 characters.'
  return USERNAME_RULES_HINT
}

/**
 * Prefer DB RPC `is_valid_username`; fall back to local format rules.
 */
export async function validateUsernameWithRpc(
  supabase: SupabaseClient,
  username: string,
): Promise<{ valid: boolean; error: string | null }> {
  const normalized = normalizeUsernameInput(username)
  const formatError = getUsernameFormatError(normalized)
  if (formatError) {
    return { valid: false, error: usernameFormatErrorMessage(formatError) }
  }

  const { data, error } = await supabase.rpc('is_valid_username', {
    username: normalized,
  })

  if (error) {
    // Local format already passed — treat RPC miss as valid-format.
    console.warn('is_valid_username RPC failed:', error.message)
    return { valid: true, error: null }
  }

  if (data === false) {
    return { valid: false, error: USERNAME_RULES_HINT }
  }

  return { valid: true, error: null }
}

/**
 * Prefer DB RPC `check_username_available`; fall back to a users select.
 */
export async function checkUsernameAvailable(
  supabase: SupabaseClient,
  username: string,
  excludeUserId: string,
): Promise<{ available: boolean; error: string | null }> {
  const normalized = normalizeUsernameInput(username)

  const { data, error } = await supabase.rpc('check_username_available', {
    username: normalized,
    exclude_user: excludeUserId,
  })

  if (!error) {
    return { available: Boolean(data), error: null }
  }

  console.warn('check_username_available RPC failed:', error.message)

  const { data: row, error: selectError } = await supabase
    .from('users')
    .select('id')
    .ilike('username', normalized)
    .maybeSingle()

  if (selectError) {
    return { available: false, error: selectError.message }
  }

  const available = !row || row.id === excludeUserId
  return { available, error: null }
}

const MAX_USERNAME_ATTEMPTS = 24

/**
 * Generate a unique sports-themed default username and persist it when missing.
 */
export async function ensureDefaultUsername(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ username: string | null; error: string | null }> {
  const { data: existing, error: loadError } = await supabase
    .from('users')
    .select('username')
    .eq('id', userId)
    .maybeSingle()

  if (loadError) {
    return { username: null, error: loadError.message }
  }

  const current = existing?.username?.trim()
  if (current) {
    return { username: current, error: null }
  }

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
    const candidate = buildSportsUsernameCandidate()
    const { available, error: availError } = await checkUsernameAvailable(
      supabase,
      candidate,
      userId,
    )
    if (availError) {
      return { username: null, error: availError }
    }
    if (!available) continue

    const { error: updateError } = await supabase
      .from('users')
      .update({ username: candidate })
      .eq('id', userId)

    if (updateError) {
      // Race — try another candidate.
      continue
    }

    const { data: confirmed } = await supabase
      .from('users')
      .select('username')
      .eq('id', userId)
      .maybeSingle()

    if (confirmed?.username) {
      return { username: confirmed.username, error: null }
    }
  }

  return {
    username: null,
    error: 'Could not generate a unique username. Try again.',
  }
}
