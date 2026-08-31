'use client'

import { useCallback, useRef, type RefObject, type TouchEvent } from 'react'

/** Swipe cycle for pool mobile — Settings is never included. */
export const POOL_MOBILE_SWIPE_TABS = [
  'home',
  'predictions',
  'leaderboard',
] as const

export type PoolMobileSwipeTab = (typeof POOL_MOBILE_SWIPE_TABS)[number]

/** Min horizontal travel (px) to commit a tab change. */
export const POOL_TAB_SWIPE_THRESHOLD_PX = 56

/** Require horizontal dominance so vertical scrolls don't flip tabs. */
export const POOL_TAB_SWIPE_HORIZONTAL_RATIO = 1.35

export function isPoolMobileSwipeTab(tab: string): tab is PoolMobileSwipeTab {
  return (POOL_MOBILE_SWIPE_TABS as readonly string[]).includes(tab)
}

function findHorizontalScrollParent(
  start: EventTarget | null,
  root: HTMLElement | null,
): HTMLElement | null {
  let el =
    start instanceof Element
      ? start
      : start instanceof Node
        ? start.parentElement
        : null
  while (el && el !== root) {
    if (el instanceof HTMLElement) {
      const { overflowX } = getComputedStyle(el)
      if (
        (overflowX === 'auto' ||
          overflowX === 'scroll' ||
          overflowX === 'overlay') &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        return el
      }
    }
    el = el.parentElement
  }
  return null
}

function horizontalScrollBlocksSwipe(
  scroller: HTMLElement,
  deltaX: number,
): boolean {
  const maxScroll = scroller.scrollWidth - scroller.clientWidth
  // Finger moves right (deltaX > 0) → content wants to scroll left (reveal left).
  if (deltaX > 0 && scroller.scrollLeft > 1) return true
  // Finger moves left → content scrolls right.
  if (deltaX < 0 && scroller.scrollLeft < maxScroll - 1) return true
  return false
}

type UsePoolTabSwipeOptions = {
  enabled: boolean
  activeTab: string
  onSwipeTab: (tab: PoolMobileSwipeTab) => void
  rootRef: RefObject<HTMLElement | null>
}

/**
 * Left/right swipe between Home ↔ Predictions ↔ Leaderboard.
 * Yields when a horizontally scrollable ancestor can still scroll in that direction.
 */
export function usePoolTabSwipe({
  enabled,
  activeTab,
  onSwipeTab,
  rootRef,
}: UsePoolTabSwipeOptions) {
  const startRef = useRef<{
    x: number
    y: number
    target: EventTarget | null
  } | null>(null)

  const onTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return
      if (!isPoolMobileSwipeTab(activeTab)) return
      const touch = event.changedTouches[0] ?? event.touches[0]
      if (!touch) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.closest('input, textarea, select, [contenteditable="true"]') ||
          target.closest('[data-pool-swipe-ignore]'))
      ) {
        startRef.current = null
        return
      }
      startRef.current = { x: touch.clientX, y: touch.clientY, target }
    },
    [activeTab, enabled],
  )

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!enabled || !startRef.current) return
      if (!isPoolMobileSwipeTab(activeTab)) {
        startRef.current = null
        return
      }
      const touch = event.changedTouches[0]
      if (!touch) {
        startRef.current = null
        return
      }
      const deltaX = touch.clientX - startRef.current.x
      const deltaY = touch.clientY - startRef.current.y
      const start = startRef.current
      startRef.current = null

      if (Math.abs(deltaX) < POOL_TAB_SWIPE_THRESHOLD_PX) return
      if (
        Math.abs(deltaX) <
        Math.abs(deltaY) * POOL_TAB_SWIPE_HORIZONTAL_RATIO
      ) {
        return
      }

      const scroller = findHorizontalScrollParent(
        start.target,
        rootRef.current,
      )
      if (scroller && horizontalScrollBlocksSwipe(scroller, deltaX)) {
        return
      }

      const idx = POOL_MOBILE_SWIPE_TABS.indexOf(activeTab)
      if (idx < 0) return
      // Swipe left (finger left, deltaX < 0) → next tab; swipe right → previous.
      if (deltaX < 0 && idx < POOL_MOBILE_SWIPE_TABS.length - 1) {
        onSwipeTab(POOL_MOBILE_SWIPE_TABS[idx + 1])
      } else if (deltaX > 0 && idx > 0) {
        onSwipeTab(POOL_MOBILE_SWIPE_TABS[idx - 1])
      }
    },
    [activeTab, enabled, onSwipeTab, rootRef],
  )

  const onTouchCancel = useCallback(() => {
    startRef.current = null
  }, [])

  return { onTouchStart, onTouchEnd, onTouchCancel }
}
