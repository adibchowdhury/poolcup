'use client'

import { toast } from 'sonner'
import { capturePostHog } from '@/src/lib/posthog-client'
import type {
  PredictionStreak,
  StreakSyncResponse,
} from '@/src/lib/prediction-streak'
import { applyXpAwardFeedback } from '@/src/lib/xp-client'
import type { XpAwardResult } from '@/src/lib/xp'

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function requestPredictionStreak(): Promise<PredictionStreak | null> {
  try {
    const response = await fetch('/api/streak', { method: 'GET', cache: 'no-store' })
    if (!response.ok) return null
    return parseJson<PredictionStreak>(response)
  } catch {
    return null
  }
}

export async function syncPredictionStreak(): Promise<StreakSyncResponse | null> {
  try {
    const response = await fetch('/api/streak', { method: 'POST', cache: 'no-store' })
    const body = await parseJson<StreakSyncResponse>(response)
    if (!response.ok) return body
    return body
  } catch {
    return null
  }
}

/** Celebrate newly crossed day milestones + feed XP into the shared feedback path. */
export function applyStreakSyncFeedback(
  result: StreakSyncResponse | null,
  options?: { onLevelUp?: (level: number) => void },
): void {
  if (!result) return

  for (const row of result.milestones) {
    toast.success(`🔥 ${row.milestone}-day streak! +${row.xp_awarded} XP`, {
      duration: 4200,
    })
    capturePostHog('streak_milestone_reached', {
      milestone: row.milestone,
      xp: row.xp_awarded,
    })
  }

  if (result.xpAwarded > 0) {
    const award: XpAwardResult = {
      awarded: result.xpAwarded,
      sourceType: 'streak_milestone',
      sourceId:
        result.milestones.map((m) => `streak_${m.milestone}`).join(',') ||
        'streak',
      levelBefore: result.levelBefore,
      levelAfter: result.levelAfter,
      highestLevel: result.highestLevel,
      alreadyHad: false,
    }
    // Milestone toasts already shown; keep XP path for level-up / analytics.
    applyXpAwardFeedback(award, {
      silent: true,
      onLevelUp: options?.onLevelUp,
    })
  } else if (result.levelAfter > result.levelBefore) {
    applyXpAwardFeedback(
      {
        awarded: 0,
        sourceType: 'streak_milestone',
        sourceId: 'streak',
        levelBefore: result.levelBefore,
        levelAfter: result.levelAfter,
        highestLevel: result.highestLevel,
        alreadyHad: true,
      },
      { silent: true, onLevelUp: options?.onLevelUp },
    )
  }
}
