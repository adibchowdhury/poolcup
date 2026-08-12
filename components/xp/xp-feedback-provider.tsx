'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { LevelUpModal } from '@/components/xp/level-up-modal'
import { applyXpAwardFeedback, requestXpAward } from '@/src/lib/xp-client'
import type { XpAwardResult } from '@/src/lib/xp'

type XpFeedbackContextValue = {
  enqueueLevelUp: (level: number) => void
  reportAward: (result: XpAwardResult | null, silent?: boolean) => void
  award: (
    body: Parameters<typeof requestXpAward>[0],
    silent?: boolean,
  ) => Promise<XpAwardResult | null>
}

const XpFeedbackContext = createContext<XpFeedbackContextValue | null>(null)

export function XpFeedbackProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<number[]>([])

  const enqueueLevelUp = useCallback((level: number) => {
    if (!Number.isFinite(level) || level < 2) return
    setQueue((current) =>
      current.includes(level) ? current : [...current, level],
    )
  }, [])

  const reportAward = useCallback(
    (result: XpAwardResult | null, silent?: boolean) => {
      applyXpAwardFeedback(result, {
        silent,
        onLevelUp: enqueueLevelUp,
      })
    },
    [enqueueLevelUp],
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

  useEffect(() => {
    const onLevelUp = (event: Event) => {
      const level = Number((event as CustomEvent<number>).detail)
      enqueueLevelUp(level)
    }
    window.addEventListener('poolcup:level-up', onLevelUp)
    return () => window.removeEventListener('poolcup:level-up', onLevelUp)
  }, [enqueueLevelUp])

  const dismiss = useCallback(() => {
    setQueue((current) => current.slice(1))
  }, [])

  const value = useMemo(
    () => ({ enqueueLevelUp, reportAward, award }),
    [enqueueLevelUp, reportAward, award],
  )

  return (
    <XpFeedbackContext.Provider value={value}>
      {children}
      <LevelUpModal level={queue[0] ?? null} onDismiss={dismiss} />
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
