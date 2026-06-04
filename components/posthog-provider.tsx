'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useAuth } from '@/src/lib/auth-context'
import { resolveUserDisplayName } from '@/src/lib/auth'
import { supabase } from '@/src/lib/supabase'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

export function PostHogIdentify() {
  const { user, loading } = useAuth()
  const posthogClient = usePostHog()

  useEffect(() => {
    if (loading || !posthogClient) return

    if (!user) {
      posthogClient.reset()
      return
    }

    let cancelled = false

    async function identifyUser() {
      const { data: profile } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return

      const display_name = resolveUserDisplayName(
        profile?.display_name,
        user.user_metadata as Record<string, unknown> | undefined,
      )

      posthogClient.identify(user.id, {
        email: user.email ?? undefined,
        display_name: display_name ?? undefined,
      })
    }

    void identifyUser()

    return () => {
      cancelled = true
    }
  }, [user, loading, posthogClient])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: '2026-01-30',
      capture_pageleave: true,
      disable_session_recording: false,
    })
  }, [])

  if (!POSTHOG_KEY) {
    return <>{children}</>
  }

  return <PHProvider client={posthog}>{children}</PHProvider>
}
