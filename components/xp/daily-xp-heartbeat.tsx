'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/src/lib/auth-context'
import { requestXpHeartbeat } from '@/src/lib/xp-client'
import { useXpFeedbackOptional } from '@/components/xp/xp-feedback-provider'

export function DailyXpHeartbeat() {
  const { user, loading } = useAuth()
  const xp = useXpFeedbackOptional()
  const ranForUser = useRef<string | null>(null)

  useEffect(() => {
    if (loading || !user?.id) return
    if (ranForUser.current === user.id) return
    ranForUser.current = user.id

    void requestXpHeartbeat().then((result) => {
      xp?.reportAward(result)
    })
  }, [loading, user?.id, xp])

  return null
}
