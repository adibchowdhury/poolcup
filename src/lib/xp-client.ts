'use client'

import { capturePostHog } from '@/src/lib/posthog-client'
import type { XpAwardResult, XpReplayResult } from '@/src/lib/xp'

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

export async function requestXpReplay(): Promise<XpReplayResult | null> {
  try {
    const response = await fetch('/api/xp/replay', { method: 'POST' })
    if (!response.ok) return null
    return parseJson<XpReplayResult>(response)
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

/**
 * Analytics-only feedback after an XP award.
 * UI toasts and level-up celebration modals were intentionally removed —
 * XP still accrues and shows on the profile Level / XP bar.
 * `silent` is retained for call-site compatibility and is unused.
 */
export function applyXpAwardFeedback(
  result: XpAwardResult | null,
  options?: {
    silent?: boolean
  },
): void {
  if (!result) return
  void options

  if (result.awarded > 0) {
    capturePostHog('xp_earned', {
      source_type: result.sourceType,
      amount: result.awarded,
    })
  }

  if (result.levelAfter > result.levelBefore) {
    capturePostHog('level_up', { new_level: result.levelAfter })
  }
}
