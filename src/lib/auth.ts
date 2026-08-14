import type { User } from '@supabase/supabase-js'
import { isStaleAuthSessionError } from './auth-session'
import {
  AUTH_ALREADY_REGISTERED_MESSAGE,
  AUTH_SIGNUP_CHECK_INBOX_MESSAGE,
  isExplicitAlreadyRegisteredError,
} from './auth-form'
import { fireRecordReferralBestEffort } from './referral'
import { supabase } from './supabase'
import { validateDisplayName } from './ugc-limits'

export type SignUpProfile = {
  firstName: string
  lastName: string
}

export type SignUpResult = {
  error: Error | null
  needsEmailConfirmation?: boolean
  /**
   * Duplicate / ambiguous signup.
   * - `explicit`: Supabase returned a clear already-registered error
   * - `ambiguous`: no session + empty identities (common anti-enumeration shape)
   */
  alreadyRegistered?: 'explicit' | 'ambiguous'
}

function buildDisplayName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}

export function resolveUserDisplayName(
  profileDisplayName: string | null | undefined,
  metadata: Record<string, unknown> | undefined,
): string | null {
  const fromProfile = profileDisplayName?.trim()
  if (fromProfile) return fromProfile

  if (!metadata) return null

  const display =
    typeof metadata.display_name === 'string'
      ? metadata.display_name.trim()
      : ''
  if (display) return display

  const first =
    typeof metadata.first_name === 'string' ? metadata.first_name.trim() : ''
  const last =
    typeof metadata.last_name === 'string' ? metadata.last_name.trim() : ''
  const combined = `${first} ${last}`.trim()
  return combined || null
}

export async function signUpWithPassword(
  email: string,
  password: string,
  profile: SignUpProfile,
): Promise<SignUpResult> {
  const firstName = profile.firstName.trim()
  const lastName = profile.lastName.trim()
  const displayName = buildDisplayName(firstName, lastName)
  const displayNameError = validateDisplayName(displayName)
  if (displayNameError) {
    return { error: new Error(displayNameError) }
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
      },
    },
  })

  if (error) {
    if (isExplicitAlreadyRegisteredError(error.message)) {
      return {
        error: new Error(AUTH_ALREADY_REGISTERED_MESSAGE),
        alreadyRegistered: 'explicit',
      }
    }
    return { error: new Error(error.message) }
  }

  const userId = data.user?.id
  const identities = data.user?.identities ?? []

  // Anti-enumeration: existing email often returns user + no session + empty identities.
  if (userId && !data.session && identities.length === 0) {
    return {
      error: new Error(AUTH_SIGNUP_CHECK_INBOX_MESSAGE),
      alreadyRegistered: 'ambiguous',
    }
  }

  // Best-effort referral: fire even without a session (email confirmation).
  // Never await — must not block or fail signup/redirect.
  if (userId) {
    fireRecordReferralBestEffort(userId)
  }

  if (userId && data.session) {
    const { error: profileError } = await supabase
      .from('users')
      .update({ display_name: displayName })
      .eq('id', userId)

    if (profileError) {
      return { error: new Error(profileError.message) }
    }

    void fetch('/api/handle-new-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch((welcomeError) => {
      console.error('handle-new-user signup trigger failed:', welcomeError)
    })
  }

  if (!data.session) {
    return { error: null, needsEmailConfirmation: true }
  }

  return { error: null }
}

export async function resendSignupVerificationEmail(
  email: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
  })

  return { error: error ? new Error(error.message) : null }
}

export async function signInWithGoogle(
  next?: string,
): Promise<{ error: Error | null }> {
  if (typeof window === 'undefined') {
    return { error: new Error('Google sign-in is only available in the browser') }
  }

  let redirectTo = `${window.location.origin}/auth/callback`
  if (next?.startsWith('/') && !next.startsWith('//')) {
    redirectTo += `?next=${encodeURIComponent(next)}`
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })

  return { error: error ? new Error(error.message) : null }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  return { error: error ? new Error(error.message) : null }
}

function getPasswordResetRedirectUrl(): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  return `${siteUrl.replace(/\/$/, '')}/auth/reset-password`
}

export async function sendPasswordResetEmail(
  email: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getPasswordResetRedirectUrl(),
  })

  return { error: error ? new Error(error.message) : null }
}

export async function signOut(): Promise<{ error: Error | null }> {
  const { resetPostHog } = await import('./posthog-client')
  resetPostHog()
  const { error } = await supabase.auth.signOut()
  return { error: error ? new Error(error.message) : null }
}

export async function getCurrentUser(): Promise<{
  user: User | null
  error: Error | null
}> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && isStaleAuthSessionError(error)) {
    await supabase.auth.signOut({ scope: 'local' })
    return { user: null, error: null }
  }

  return {
    user: user ?? null,
    error: error ? new Error(error.message) : null,
  }
}
