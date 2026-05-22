import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

function getAuthCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL must be set for server-side auth redirects'
    )
  }
  return `${siteUrl.replace(/\/$/, '')}/auth/callback`
}

export async function sendMagicLink(
  email: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: getAuthCallbackUrl(),
    },
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
