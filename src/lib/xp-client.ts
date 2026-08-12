'use client'

import { toast } from 'sonner'
import { capturePostHog } from '@/src/lib/posthog-client'
import type { XpAwardResult } from '@/src/lib/xp'

export type EvaluateXpResponse = {
  newlyAwardedIds: string[]
  xpAwarded: number
  awards: Array<{ id: string; amount: number; name: string }>
  levelBefore: number
  levelAfter: number
  highestLevel: number
  totalXp: number
  error?: string
}

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function awardClientXp(
  body: Parameters<typeof requestXpAward>[0],
  silent?: boolean,
): Promise<XpAwardResult | null> {
  const result = await requestXpAward(body)
  applyXpAwardFeedback(result, { silent })
  return result
}

export async function requestXpAward(body: {
  sourceType: string
  sourceId?: string
  inviterUserId?: string
  otherUserId?: string
}): Promise<XpAwardResult | null> {
  try {
    const response = await fetch('/api/xp/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) return null
    return parseJson<XpAwardResult>(response)
  } catch {
    return null
  }
}

export async function requestXpHeartbeat(): Promise<XpAwardResult | null> {
  try {
    const response = await fetch('/api/xp/heartbeat', { method: 'POST' })
    if (!response.ok) return null
    return parseJson<XpAwardResult>(response)
  } catch {
    return null
  }
}

export async function requestXpEvaluate(): Promise<EvaluateXpResponse | null> {
  try {
    const response = await fetch('/api/xp/evaluate', { method: 'POST' })
    if (!response.ok) {
      const body = await parseJson<EvaluateXpResponse>(response)
      return body
    }
    return parseJson<EvaluateXpResponse>(response)
  } catch {
    return null
  }
}

export function applyXpAwardFeedback(
  result: XpAwardResult | null,
  options?: {
    onLevelUp?: (level: number) => void
    silent?: boolean
  },
): void {
  if (!result) return

  if (result.awarded > 0) {
    if (!options?.silent) {
      toast.success(`+${result.awarded} XP`, { duration: 2800 })
    }
    capturePostHog('xp_earned', {
      source_type: result.sourceType,
      amount: result.awarded,
    })
  }

  if (result.levelAfter > result.levelBefore) {
    options?.onLevelUp?.(result.levelAfter)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('poolcup:level-up', { detail: result.levelAfter }),
      )
    }
    capturePostHog('level_up', { new_level: result.levelAfter })
  }
}
