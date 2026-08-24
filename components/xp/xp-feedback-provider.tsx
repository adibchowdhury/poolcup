'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { applyXpAwardFeedback, requestXpAward } from '@/src/lib/xp-client'
import type { XpAwardResult } from '@/src/lib/xp'

type XpFeedbackContextValue = {
  reportAward: (result: XpAwardResult | null, silent?: boolean) => void
  award: (
    body: Parameters<typeof requestXpAward>[0],
    silent?: boolean,
  ) => Promise<XpAwardResult | null>
}

const XpFeedbackContext = createContext<XpFeedbackContextValue | null>(null)

/**
 * Wires client XP award helpers. Does not show toasts or level-up modals —
 * awards are silent in the UI; progression still appears on the profile.
 */
export function XpFeedbackProvider({ children }: { children: ReactNode }) {
  const reportAward = useCallback(
    (result: XpAwardResult | null, silent?: boolean) => {
      applyXpAwardFeedback(result, { silent })
    },
    [],
  )

  const award = useCallback(
    async (
      body: Parameters<typeof requestXpAward>[0],
      silent?: boolean,
    ) => {
      const result = await requestXpAward(body)
      reportAward(result, silent)
      return result
    },
    [reportAward],
  )

  const value = useMemo(
    () => ({ reportAward, award }),
    [reportAward, award],
  )

  return (
    <XpFeedbackContext.Provider value={value}>
      {children}
    </XpFeedbackContext.Provider>
  )
}

export function useXpFeedback(): XpFeedbackContextValue {
  const ctx = useContext(XpFeedbackContext)
  if (!ctx) {
    throw new Error('useXpFeedback must be used within XpFeedbackProvider')
  }
  return ctx
}

export function useXpFeedbackOptional(): XpFeedbackContextValue | null {
  return useContext(XpFeedbackContext)
}
