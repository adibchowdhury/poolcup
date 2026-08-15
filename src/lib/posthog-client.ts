import posthog from 'posthog-js'

/**
 * Property keys that must never be sent to PostHog (person or event props).
 * Matching is case-insensitive; underscores/hyphens normalized away for aliases.
 */
const PII_PROPERTY_KEYS = new Set(
  [
    'email',
    'username',
    'user_name',
    'display_name',
    'displayname',
    'full_name',
    'fullname',
    'first_name',
    'firstname',
    'last_name',
    'lastname',
    'real_name',
    'avatar',
    'avatar_url',
    'profile_image',
    'profile_image_url',
    'invite_code',
    'invitecode',
    'phone',
    'phone_number',
    'password',
    // Free-text search often contains usernames / emails
    'query',
    // URLs may embed invite codes or usernames
    'href',
    'url',
    'pool_name',
    'poolname',
  ].map((k) => k.toLowerCase()),
)

function normalizePropKey(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, '')
}

const PII_KEYS_NORMALIZED = new Set(
  [...PII_PROPERTY_KEYS].map((k) => normalizePropKey(k)),
)

/** True if a key looks like PII (exact deny-list or *email* / *username* / *invitecode*). */
export function isPostHogPiiPropertyKey(key: string): boolean {
  const lower = key.toLowerCase()
  if (PII_PROPERTY_KEYS.has(lower)) return true
  if (PII_KEYS_NORMALIZED.has(normalizePropKey(key))) return true
  if (lower.includes('email')) return true
  if (lower.includes('username') || lower.includes('user_name')) return true
  if (lower.includes('display_name') || lower.includes('displayname')) return true
  if (lower.includes('invite_code') || lower.includes('invitecode')) return true
  if (lower.endsWith('_avatar') || lower === 'avatar_url') return true
  return false
}

/**
 * Strip known PII keys from event/person property bags.
 * Internal UUIDs and non-identifying dimensions (tier, plan, counts) are kept.
 */
export function sanitizePostHogProperties(
  properties?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  if (!properties) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (isPostHogPiiPropertyKey(key)) continue
    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = sanitizePostHogProperties(
        value as Record<string, unknown>,
      )
      if (nested && Object.keys(nested).length > 0) out[key] = nested
      continue
    }
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Identify by internal UUID only — never attach email/username/avatar/etc. */
export function identifyPostHogUser(userId: string): void {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return
  }

  posthog.identify(userId)
  // Clear any previously stored PII person props from older clients.
  posthog.capture('$set', {
    $unset: [
      'email',
      'username',
      'user_name',
      'display_name',
      'name',
      'full_name',
      'first_name',
      'last_name',
      'avatar',
      'avatar_url',
      'invite_code',
    ],
  })
}

export function resetPostHog(): void {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return
  }

  posthog.reset()
}

export function capturePostHog(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return
  }

  posthog.capture(event, sanitizePostHogProperties(properties))
}

export function poolCreatedMode(
  scoringStyle: string,
): 'winner_only' | 'score_predictor' {
  return scoringStyle === 'winner' ? 'winner_only' : 'score_predictor'
}
