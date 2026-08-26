'use client'

import dynamic from 'next/dynamic'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

const CreatePoolPlanFireLottie = dynamic(
  () =>
    import('./create-pool-plan-fire-lottie').then(
      (mod) => mod.CreatePoolPlanFireLottie,
    ),
  { ssr: false },
)

/** Card-top-center in overlay-layer local coordinates — the only runtime-derived anchor. */
type AnchorPoint = { x: number; y: number }

type CreatePoolPlanFireOverlayProps = {
  modalRef: RefObject<HTMLElement | null>
  layerRef: RefObject<HTMLDivElement | null>
  active: boolean
  leftPanelStep: number
  rightPanelStep: number | null
  leftOpacity: number
  rightOpacity: number
  planStep: number
  prefersReducedMotion: boolean
}

function resolveAnchorCard(
  modalRoot: HTMLElement,
  planStep: number,
  leftPanelStep: number,
  rightPanelStep: number | null,
  leftOpacity: number,
  rightOpacity: number,
): HTMLElement | null {
  const leftPane = modalRoot.querySelector<HTMLElement>(
    '[data-create-pool-pane="left"]',
  )
  const rightPane = modalRoot.querySelector<HTMLElement>(
    '[data-create-pool-pane="right"]',
  )

  const candidates: Array<{ opacity: number; el: HTMLElement | null }> = []

  if (leftPanelStep === planStep && leftPane) {
    candidates.push({
      opacity: leftOpacity,
      el: leftPane.querySelector<HTMLElement>('.create-pool-plan-card--custom'),
    })
  }
  if (rightPanelStep === planStep && rightPane) {
    candidates.push({
      opacity: rightOpacity,
      el: rightPane.querySelector<HTMLElement>('.create-pool-plan-card--custom'),
    })
  }

  candidates.sort((a, b) => b.opacity - a.opacity)
  return candidates.find((c) => c.opacity > 0.01 && c.el)?.el ?? null
}

/** Card top-center relative to the overlay layer — same coordinate system as the portal. */
function deriveAnchorPoint(
  card: HTMLElement,
  layer: HTMLElement,
): AnchorPoint {
  const cardRect = card.getBoundingClientRect()
  const layerRect = layer.getBoundingClientRect()
  return {
    x: cardRect.left - layerRect.left + cardRect.width / 2,
    y: cardRect.top - layerRect.top,
  }
}

function collectScrollTargets(
  from: HTMLElement,
  stopAt: HTMLElement,
): HTMLElement[] {
  const targets: HTMLElement[] = []
  let el: HTMLElement | null = from
  while (el && el !== stopAt) {
    const { overflowY, overflow } = getComputedStyle(el)
    if (/(auto|scroll|overlay)/.test(`${overflowY}${overflow}`)) {
      targets.push(el)
    }
    el = el.parentElement
  }
  return targets
}

export function CreatePoolPlanFireOverlay({
  modalRef,
  layerRef,
  active,
  leftPanelStep,
  rightPanelStep,
  leftOpacity,
  rightOpacity,
  planStep,
  prefersReducedMotion,
}: CreatePoolPlanFireOverlayProps) {
  const [anchorPoint, setAnchorPoint] = useState<AnchorPoint | null>(null)
  const [portalReady, setPortalReady] = useState(false)
  const measureRef = useRef<() => void>(() => {})

  useEffect(() => {
    setPortalReady(true)
  }, [])

  const measure = useCallback(() => {
    const modalRoot = modalRef.current
    const layer = layerRef.current
    if (!active || !modalRoot || !layer) {
      setAnchorPoint(null)
      return
    }

    const anchor = resolveAnchorCard(
      modalRoot,
      planStep,
      leftPanelStep,
      rightPanelStep,
      leftOpacity,
      rightOpacity,
    )
    if (!anchor) {
      setAnchorPoint(null)
      return
    }

    setAnchorPoint(deriveAnchorPoint(anchor, layer))
  }, [
    active,
    layerRef,
    leftOpacity,
    leftPanelStep,
    modalRef,
    planStep,
    rightOpacity,
    rightPanelStep,
  ])

  measureRef.current = measure

  useLayoutEffect(() => {
    const modalRoot = modalRef.current
    if (!active || !modalRoot) {
      setAnchorPoint(null)
      return
    }

    const runMeasure = () => measureRef.current()

    runMeasure()

    const ro = new ResizeObserver(runMeasure)
    ro.observe(modalRoot)

    let observedCard: HTMLElement | null = null
    const scrollTargets = new Set<HTMLElement>()

    const syncObservers = () => {
      const card = resolveAnchorCard(
        modalRoot,
        planStep,
        leftPanelStep,
        rightPanelStep,
        leftOpacity,
        rightOpacity,
      )

      if (card !== observedCard) {
        if (observedCard) ro.unobserve(observedCard)
        for (const target of scrollTargets) {
          target.removeEventListener('scroll', runMeasure)
        }
        scrollTargets.clear()

        observedCard = card
        if (card) {
          ro.observe(card)
          for (const target of collectScrollTargets(card, modalRoot)) {
            scrollTargets.add(target)
            target.addEventListener('scroll', runMeasure, { passive: true })
          }
        }
      }

      runMeasure()
    }

    syncObservers()

    window.addEventListener('resize', runMeasure)
    window.addEventListener('scroll', runMeasure, true)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', runMeasure)
      window.removeEventListener('scroll', runMeasure, true)
      for (const target of scrollTargets) {
        target.removeEventListener('scroll', runMeasure)
      }
    }
  }, [
    active,
    leftOpacity,
    leftPanelStep,
    modalRef,
    planStep,
    rightOpacity,
    rightPanelStep,
  ])

  if (!portalReady || !active || !anchorPoint || !layerRef.current) return null

  return createPortal(
    <div
      className="create-pool-plan-fire-anchor"
      style={{
        transform: `translate(${anchorPoint.x}px, ${anchorPoint.y}px)`,
      }}
      aria-hidden
    >
      <div className="create-pool-plan-fire-overlay">
        <CreatePoolPlanFireLottie animate={!prefersReducedMotion} />
      </div>
    </div>,
    layerRef.current,
  )
}
