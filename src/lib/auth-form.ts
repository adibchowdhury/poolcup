/** Shared client-side auth form helpers (no secrets). */

const EMAIL_FORMAT =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const AUTH_INVALID_EMAIL_MESSAGE =
  'Enter a valid email address (for example, you@example.com).'

export const AUTH_ALREADY_REGISTERED_MESSAGE =
  'This email is already registered. Sign in, or use Forgot password if you need to reset.'

/** Soft copy when Supabase anti-enumerates (no clear duplicate error). */
export const AUTH_SIGNUP_CHECK_INBOX_MESSAGE =
  'If this email is already registered, check your inbox for a confirmation link or try signing in. Otherwise, check your email to confirm your new account.'

export const AUTH_FOCUS_VISIBLE_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]/50'

export const AUTH_PRIMARY_SUBMIT_CLASS =
  `w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-50 ${AUTH_FOCUS_VISIBLE_CLASS}`

export function isValidEmailFormat(email: string): boolean {
  const trimmed = email.trim()
  if (!trimmed || trimmed.length > 254) return false
  return EMAIL_FORMAT.test(trimmed)
}

/** True when Supabase error text clearly indicates a duplicate account. */
export function isExplicitAlreadyRegisteredError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('already registered') ||
    lower.includes('already been registered') ||
    lower.includes('user already exists') ||
    lower.includes('email address is already') ||
    lower.includes('already exists')
  )
}
