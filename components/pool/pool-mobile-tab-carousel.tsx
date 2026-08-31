'use client'

import {
  Children,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { POOL_MOBILE_CONTENT_PAD_CLASS } from '@/src/lib/pool-mobile-chrome'

/** Slide duration — compositor-friendly transform only. */
export const POOL_TAB_CAROUSEL_MS = 280

export type PoolMobileTabCarouselHandle = {
  /** Apply track translate immediately (same frame as tap) — bypasses React commit. */
  goToIndex: (index: number, opts?: { animate?: boolean }) => void
}

type PoolMobileTabCarouselProps = {
  /** 0 = Home, 1 = Predictions, 2 = Leaderboard — kept in sync after imperative goToIndex. */
  activeIndex: number
  reducedMotion?: boolean
  children: ReactNode
  className?: string
}

function trackTransform(index: number): string {
  return `translate3d(-${index * 100}%, 0, 0)`
}

/**
 * Horizontal track for the three mobile pool panes.
 * Transform is written imperatively (never via React `style.transform`) so a
 * parent re-render cannot clobber an in-flight slide. Tap/swipe call `goToIndex`
 * in the event handler; `activeIndex` only drives aria-hidden + external sync.
 */
export const PoolMobileTabCarousel = forwardRef<
  PoolMobileTabCarouselHandle,
  PoolMobileTabCarouselProps
>(function PoolMobileTabCarousel(
  { activeIndex, reducedMotion = false, children, className },
  ref,
) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const lastIndexRef = useRef(activeIndex)
  const panes = Children.toArray(children)

  const applyIndex = (index: number, animate: boolean) => {
    const el = trackRef.current
    if (!el) return
    const next = trackTransform(index)
    el.getAnimations().forEach((a) => a.cancel())
    if (!animate) {
      const prev = el.style.transitionDuration
      el.style.transitionDuration = '0ms'
      el.style.transform = next
      void el.offsetWidth
      el.style.transitionDuration = prev || `${POOL_TAB_CAROUSEL_MS}ms`
    } else {
      // Prefer WAAPI — starts on the compositor without waiting for a CSS
      // transition frame after a busy main thread.
      const from = getComputedStyle(el).transform
      el.style.transitionDuration = '0ms'
      el.style.transform = next
      try {
        el.animate(
          [
            {
              transform:
                from === 'none'
                  ? trackTransform(lastIndexRef.current)
                  : from,
            },
            { transform: next },
          ],
          {
            duration: POOL_TAB_CAROUSEL_MS,
            easing: 'cubic-bezier(0, 0, 0.2, 1)',
            fill: 'forwards',
          },
        )
      } catch {
        el.style.transitionDuration = `${POOL_TAB_CAROUSEL_MS}ms`
        el.style.transform = next
      }
    }
    lastIndexRef.current = index
  }

  useImperativeHandle(
    ref,
    () => ({
      goToIndex(index: number, opts?: { animate?: boolean }) {
        const animate = opts?.animate !== false && !reducedMotion
        applyIndex(index, animate)
      },
    }),
    [reducedMotion],
  )

  // Initial position + external activeIndex changes (popstate / deferred setState).
  useLayoutEffect(() => {
    if (!trackRef.current) return
    if (lastIndexRef.current === activeIndex && trackRef.current.style.transform) {
      return
    }
    // Animate when index moved without goToIndex (e.g. back/forward).
    applyIndex(activeIndex, !reducedMotion)
  }, [activeIndex, reducedMotion])

  return (
    <div
      className={cn('w-full min-w-0 overflow-hidden', className)}
      data-pool-tab-carousel
    >
      <div
        ref={trackRef}
        className={cn(
          'flex w-full will-change-transform',
          !reducedMotion && 'ease-out',
        )}
        style={{
          // Transform intentionally omitted — owned by goToIndex / layout effect.
          transitionProperty: 'transform',
          transitionDuration: reducedMotion ? '0ms' : `${POOL_TAB_CAROUSEL_MS}ms`,
          transitionTimingFunction: reducedMotion
            ? 'linear'
            : 'cubic-bezier(0, 0, 0.2, 1)',
        }}
        data-pool-tab-track
      >
        {panes.map((pane, index) => (
          <div
            key={index}
            className={cn(
              'min-w-full w-full shrink-0 grow-0 basis-full',
              index < 2 && POOL_MOBILE_CONTENT_PAD_CLASS,
            )}
            data-pool-tab-pane={index}
            aria-hidden={index !== activeIndex}
          >
            {pane}
          </div>
        ))}
      </div>
    </div>
  )
})
