'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  BadgeUnlockModal,
  type BadgeUnlockItem,
} from '@/components/achievements/badge-unlock-modal'
import type { UserAchievementsData } from '@/src/lib/fetch-user-achievements'
import {
  TEST_FORCE_WELCOME_BADGE,
  TEST_WELCOME_ABOARD_BADGE,
} from '@/src/lib/badge-unlock-test'

type BadgeUnlockContextValue = {
  /** Enqueue newly-awarded badges from a fetchUserAchievements result (deduped). */
  enqueueFromAchievementsData: (data: UserAchievementsData) => void
  enqueueBadges: (badges: BadgeUnlockItem[]) => void
}

const BadgeUnlockContext = createContext<BadgeUnlockContextValue | null>(null)

function resolveNewlyAwardedBadges(
  data: UserAchievementsData,
): BadgeUnlockItem[] {
  if (!data.newlyAwardedIds.length) return []

  const byId = new Map(
    data.achievements.map((badge) => [badge.id, badge] as const),
  )

  return data.newlyAwardedIds
    .map((id) => {
      const badge = byId.get(id)
      if (!badge) return null
      return {
        id: badge.id,
        name: badge.name,
        xp_value: badge.xp_value ?? 0,
      } satisfies BadgeUnlockItem
    })
    .filter((badge): badge is BadgeUnlockItem => badge != null)
}

export function BadgeUnlockProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<BadgeUnlockItem[]>([])
  const seenIdsRef = useRef(new Set<string>())

  const enqueueBadges = useCallback((badges: BadgeUnlockItem[]) => {
    if (!badges.length) return

    setQueue((current) => {
      const next: BadgeUnlockItem[] = []
      for (const badge of badges) {
        if (!badge?.id || seenIdsRef.current.has(badge.id)) continue
        seenIdsRef.current.add(badge.id)
        next.push(badge)
      }
      if (!next.length) return current
      return [...current, ...next]
    })
  }, [])

  const enqueueFromAchievementsData = useCallback(
    (data: UserAchievementsData) => {
      enqueueBadges(resolveNewlyAwardedBadges(data))
    },
    [enqueueBadges],
  )

  // TEMPORARY TEST CODE — force Welcome Aboard celebration on every mount.
  useEffect(() => {
    if (!TEST_FORCE_WELCOME_BADGE) return

    // Bypass session dedupe so the design can be re-tested on each load.
    seenIdsRef.current.delete(TEST_WELCOME_ABOARD_BADGE.id)
    enqueueBadges([
      {
        id: TEST_WELCOME_ABOARD_BADGE.id,
        name: TEST_WELCOME_ABOARD_BADGE.name,
        xp_value: TEST_WELCOME_ABOARD_BADGE.xp_value,
      },
    ])
  }, [enqueueBadges])

  const dismissCurrent = useCallback(() => {
    setQueue((current) => current.slice(1))
  }, [])

  const value = useMemo(
    () => ({ enqueueFromAchievementsData, enqueueBadges }),
    [enqueueFromAchievementsData, enqueueBadges],
  )

  const current = queue[0] ?? null

  return (
    <BadgeUnlockContext.Provider value={value}>
      {children}
      <BadgeUnlockModal
        badge={current}
        remainingCount={Math.max(0, queue.length - 1)}
        onDismiss={dismissCurrent}
      />
    </BadgeUnlockContext.Provider>
  )
}

export function useBadgeUnlock(): BadgeUnlockContextValue {
  const ctx = useContext(BadgeUnlockContext)
  if (!ctx) {
    throw new Error('useBadgeUnlock must be used within BadgeUnlockProvider')
  }
  return ctx
}

/** Safe variant for optional wiring — no-ops outside the provider. */
export function useBadgeUnlockOptional(): BadgeUnlockContextValue | null {
  return useContext(BadgeUnlockContext)
}
