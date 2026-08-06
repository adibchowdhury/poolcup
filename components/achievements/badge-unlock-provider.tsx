'use client'

import {
  createContext,
  useCallback,
  useContext,
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

  const items: BadgeUnlockItem[] = []
  for (const id of data.newlyAwardedIds) {
    const badge = byId.get(id)
    if (!badge) continue
    items.push({
      id: badge.id,
      name: badge.name,
      xp_value: badge.xp_value ?? 0,
      art_filename: badge.art_filename ?? null,
      imageUrl: badge.imageUrl ?? null,
    })
  }
  return items
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
