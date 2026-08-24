'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/src/lib/auth-context'
import { requestXpHeartbeat, requestXpReplay } from '@/src/lib/xp-client'
import { useXpFeedbackOptional } from '@/components/xp/xp-feedback-provider'

/**
 * Once per signed-in session: daily_active, then welcome-back replay of XP
 * earned while away (cron prediction awards). Heartbeat runs first so daily
 * XP is awarded and watermarked before the away summary. No UI popups.
 */
export function DailyXpHeartbeat() {
  const { user, loading } = useAuth()
  const xp = useXpFeedbackOptional()
  const ranForUser = useRef<string | null>(null)

  useEffect(() => {
    if (loading || !user?.id) return
    if (ranForUser.current === user.id) return
    ranForUser.current = user.id

    void requestXpHeartbeat()
      .then((heartbeat) => {
        xp?.reportAward(heartbeat)
        return requestXpReplay()
      })
      .then((replay) => {
        if (!replay || replay.seeded || replay.awarded <= 0) return
        xp?.reportAward({
          awarded: replay.awarded,
          sourceType: 'welcome_back',
          sourceId:
            replay.predictionAwarded > 0 &&
            replay.predictionAwarded === replay.awarded
              ? 'predictions'
              : 'away',
          levelBefore: replay.levelBefore,
          levelAfter: replay.levelAfter,
          highestLevel: replay.levelAfter,
          alreadyHad: false,
        })
      })
  }, [loading, user?.id, xp])

  return null
}
