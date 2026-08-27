'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'
import {
  buildTicketSilhouetteCssMask,
  CREATE_POOL_MODAL_STUB_FOOTER_REGION_PX,
  extractMaskImageUrls,
  probeMaskImageUrl,
  type TicketSilhouetteCssMask,
} from '@/src/lib/create-pool-ticket-silhouette-mask'

const MIN_MASK_DIMENSION_PX = 100
const MASK_WATCHDOG_MS = 500

/** Never touch the observed shell node — probe on body only. */
function readStubFooterRegionPx(): number {
  if (typeof document === 'undefined') {
    return CREATE_POOL_MODAL_STUB_FOOTER_REGION_PX
  }

  try {
    const probe = document.createElement('div')
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.style.pointerEvents = 'none'
    probe.style.height =
      'calc(2rem + 1rem + 0.375rem + 2.5rem + 2.25rem)'
    document.body.appendChild(probe)
    const px = probe.offsetHeight
    probe.remove()
    return px > 0 ? px : CREATE_POOL_MODAL_STUB_FOOTER_REGION_PX
  } catch {
    return CREATE_POOL_MODAL_STUB_FOOTER_REGION_PX
  }
}

function applyCssMask(el: HTMLElement, mask: TicketSilhouetteCssMask) {
  el.style.setProperty('mask-image', mask.maskImage)
  el.style.setProperty('-webkit-mask-image', mask.maskImage)
  el.style.setProperty('mask-size', '100% 100%')
  el.style.setProperty('-webkit-mask-size', '100% 100%')
  el.style.setProperty('mask-repeat', 'no-repeat')
  el.style.setProperty('-webkit-mask-repeat', 'no-repeat')
  el.style.setProperty('mask-composite', mask.maskComposite)
  el.style.setProperty('-webkit-mask-composite', mask.webkitMaskComposite)
}

function clearTicketSilhouetteMask(el: HTMLElement | null) {
  if (!el) return
  try {
    for (const prop of [
      'mask-image',
      '-webkit-mask-image',
      'mask-size',
      '-webkit-mask-size',
      'mask-repeat',
      '-webkit-mask-repeat',
      'mask-composite',
      '-webkit-mask-composite',
    ]) {
      el.style.removeProperty(prop)
    }
  } catch {
    // Silhouette cleanup must never throw.
  }
}

/**
 * Invariant: a url()-based mask that cannot be proven renderable never ships.
 * CSS gradient masks have no fetchable URL — always allowed.
 */
async function assertMaskRenderable(maskImage: string): Promise<boolean> {
  const urls = extractMaskImageUrls(maskImage)
  if (urls.length === 0) return true

  for (const src of urls) {
    const ok = await probeMaskImageUrl(src)
    if (!ok) {
      console.warn(
        '[create-pool] ticket silhouette mask URL failed Image() load — refusing to apply',
        src.slice(0, 96),
      )
      return false
    }
  }
  return true
}

/**
 * Step-1+ desktop modal — layered CSS-gradient ticket silhouette (all steps).
 * Regenerates on shell resize. Failures degrade to no mask (visible shell).
 * `active` stays true for the whole modal lifetime so step transitions do not
 * tear down / rebuild the mask (shell persists; mask persists).
 */
export function useCreatePoolTicketSilhouetteMask(
  shellRef: RefObject<HTMLElement | null>,
  active: boolean,
) {
  const rafIdRef = useRef(0)
  const retryRafIdRef = useRef(0)
  const lastGoodMaskRef = useRef<TicketSilhouetteCssMask | null>(null)
  const firstFrameLoggedRef = useRef(false)
  const saneMaskAchievedRef = useRef(false)
  const retryStoppedRef = useRef(false)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const applyGenRef = useRef(0)

  useLayoutEffect(() => {
    if (!active) return

    firstFrameLoggedRef.current = false
    saneMaskAchievedRef.current = false
    retryStoppedRef.current = false
    lastGoodMaskRef.current = null
    applyGenRef.current += 1
    const applyGen = applyGenRef.current

    const runMaskUpdate = () => {
      const el = shellRef.current
      if (!el?.isConnected) return
      if (applyGen !== applyGenRef.current) return

      try {
        const rect = el.getBoundingClientRect()
        const width = rect.width
        const height = rect.height

        if (!firstFrameLoggedRef.current) {
          firstFrameLoggedRef.current = true
          console.info('[create-pool] ticket silhouette first-frame rect:', {
            width,
            height,
          })
        }

        if (width < MIN_MASK_DIMENSION_PX || height < MIN_MASK_DIMENSION_PX) {
          if (lastGoodMaskRef.current) {
            applyCssMask(el, lastGoodMaskRef.current)
          }
          if (!retryStoppedRef.current) {
            cancelAnimationFrame(retryRafIdRef.current)
            retryRafIdRef.current = requestAnimationFrame(runMaskUpdate)
          }
          return
        }

        const mask = buildTicketSilhouetteCssMask({
          width,
          height,
          stubFooterRegionPx: readStubFooterRegionPx(),
        })

        void (async () => {
          const renderable = await assertMaskRenderable(mask.maskImage)
          if (applyGen !== applyGenRef.current) return
          const target = shellRef.current
          if (!target?.isConnected) return

          if (!renderable) {
            clearTicketSilhouetteMask(target)
            lastGoodMaskRef.current = null
            return
          }

          applyCssMask(target, mask)
          lastGoodMaskRef.current = mask
          saneMaskAchievedRef.current = true
          if (watchdogRef.current) {
            clearTimeout(watchdogRef.current)
            watchdogRef.current = null
          }
        })()
      } catch (err) {
        console.warn('[create-pool] ticket silhouette mask skipped:', err)
        if (lastGoodMaskRef.current && shellRef.current?.isConnected) {
          applyCssMask(shellRef.current, lastGoodMaskRef.current)
        } else {
          clearTicketSilhouetteMask(shellRef.current)
        }
      }
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => {
        requestAnimationFrame(runMaskUpdate)
      })
    }

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== shellRef.current) return
      scheduleUpdate()
    }

    scheduleUpdate()

    watchdogRef.current = setTimeout(() => {
      if (saneMaskAchievedRef.current) return
      retryStoppedRef.current = true
      cancelAnimationFrame(retryRafIdRef.current)
      console.warn(
        '[create-pool] ticket silhouette watchdog: clearing mask (no sane dimensions within 500ms)',
      )
      clearTicketSilhouetteMask(shellRef.current)
      lastGoodMaskRef.current = null
    }, MASK_WATCHDOG_MS)

    let ro: ResizeObserver | null = null
    const el = shellRef.current
    if (el && typeof ResizeObserver !== 'undefined') {
      try {
        ro = new ResizeObserver(scheduleUpdate)
        ro.observe(el)
        el.addEventListener('animationend', scheduleUpdate)
        el.addEventListener('transitionend', onTransitionEnd)
      } catch (err) {
        console.warn(
          '[create-pool] ticket silhouette ResizeObserver skipped:',
          err,
        )
      }
    }

    window.addEventListener('resize', scheduleUpdate)

    return () => {
      applyGenRef.current += 1
      cancelAnimationFrame(rafIdRef.current)
      cancelAnimationFrame(retryRafIdRef.current)
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current)
        watchdogRef.current = null
      }
      window.removeEventListener('resize', scheduleUpdate)
      ro?.disconnect()
      el?.removeEventListener('animationend', scheduleUpdate)
      el?.removeEventListener('transitionend', onTransitionEnd)
      clearTicketSilhouetteMask(shellRef.current)
      lastGoodMaskRef.current = null
    }
  }, [active, shellRef])
}
