'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/lib/auth-context'
import { resolveUserDisplayName } from '@/src/lib/auth'
import { supabase } from '@/src/lib/supabase'

type PostHogClient = {
  identify: (distinctId: string, properties?: Record<string, unknown>) => void
  reset: () => void
}

declare global {
  interface Window {
    posthog?: PostHogClient
  }
}

function whenPostHogReady(
  callback: (client: PostHogClient) => void,
  maxAttempts = 50,
) {
  let attempts = 0

  const tick = () => {
    const client = window.posthog
    if (client && typeof client.identify === 'function') {
      callback(client)
      return
    }
    if (attempts < maxAttempts) {
      attempts += 1
      window.setTimeout(tick, 100)
    }
  }

  tick()
}

export function PostHogIdentify() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return

    let cancelled = false

    whenPostHogReady((posthogClient) => {
      if (cancelled) return

      if (!user) {
        posthogClient.reset()
        return
      }

      void (async () => {
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
      })()
    })

    return () => {
      cancelled = true
    }
  }, [user, loading])

  return null
}
