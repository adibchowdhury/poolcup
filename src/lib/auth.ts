import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type SignUpProfile = {
  firstName: string
  lastName: string
}

function buildDisplayName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}

export async function signUpWithPassword(
  email: string,
  password: string,
  profile: SignUpProfile
): Promise<{ error: Error | null; needsEmailConfirmation?: boolean }> {
  const firstName = profile.firstName.trim()
  const lastName = profile.lastName.trim()
  const displayName = buildDisplayName(firstName, lastName)

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
    return { error: new Error(error.message) }
  }

  const userId = data.user?.id

  if (userId && data.session) {
    const { error: profileError } = await supabase
      .from('users')
      .update({ display_name: displayName })
      .eq('id', userId)

    if (profileError) {
      return { error: new Error(profileError.message) }
    }
  }

  if (!data.session) {
    return { error: null, needsEmailConfirmation: true }
  }

  return { error: null }
}

export async function signInWithPassword(
  email: string,
  password: string
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
  email: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getPasswordResetRedirectUrl(),
  })

  return { error: error ? new Error(error.message) : null }
}

export async function signOut(): Promise<{ error: Error | null }> {
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

  return {
    user: user ?? null,
    error: error ? new Error(error.message) : null,
  }
}
