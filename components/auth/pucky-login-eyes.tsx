'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import {
  PUCKY_EYES,
  PUCKY_EYE_TRACKING,
  PUCKY_GAZE_REF,
  type PuckyEyeCalibration,
} from '@/src/lib/pucky-eye-calibration'

type FrameBox = {
  left: number
  top: number
  width: number
  height: number
}

type Offset = { x: number; y: number }

/** Ellipse clamp with independent +X/−X and +Y/−Y radii (for beak-side padding). */
function clampEllipseAsym(
  dx: number,
  dy: number,
  rxPos: number,
  rxNeg: number,
  ryPos: number,
  ryNeg: number,
): Offset {
  const rx = dx >= 0 ? rxPos : rxNeg
  const ry = dy >= 0 ? ryPos : ryNeg
  if (rx <= 0 || ry <= 0) return { x: 0, y: 0 }
  const v = (dx / rx) ** 2 + (dy / ry) ** 2
  if (v <= 1 || !Number.isFinite(v)) return { x: dx, y: dy }
  const s = 1 / Math.sqrt(v)
  return { x: dx * s, y: dy * s }
}

/**
 * Shared gaze: one vector from face midpoint → cursor, capped by maxRadius,
 * then clamped per-eye (own ellipse + beak-facing inward pad).
 */
function sharedGazeOffset(
  gazeX: number,
  gazeY: number,
  maxRadius: number,
  rxPos: number,
  rxNeg: number,
  ryPos: number,
  ryNeg: number,
): Offset {
  let dx = gazeX
  let dy = gazeY
  const dist = Math.hypot(dx, dy)
  if (dist > maxRadius && dist > 0) {
    const scale = maxRadius / dist
    dx *= scale
    dy *= scale
  }
  return clampEllipseAsym(dx, dy, rxPos, rxNeg, ryPos, ryNeg)
}

function IrisAssembly({
  eye,
  box,
  offset,
}: {
  eye: PuckyEyeCalibration
  box: FrameBox
  offset: Offset
}) {
  const irisW = eye.iris.w * box.width
  const irisH = eye.iris.h * box.height
  const left = eye.iris.cx * box.width - irisW / 2 + offset.x
  const top = eye.iris.cy * box.height - irisH / 2 + offset.y

  const pupilW = eye.pupil.relW * irisW
  const pupilH = eye.pupil.relH * irisH
  const highlightSize = eye.highlight.sizeVsIris * Math.min(irisW, irisH)

  const irisStyle: CSSProperties = {
    position: 'absolute',
    left,
    top,
    width: irisW,
    height: irisH,
    borderRadius: '50%',
    background: eye.iris.color,
    overflow: 'visible',
    pointerEvents: 'none',
  }

  const pupilStyle: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: pupilW,
    height: pupilH,
    marginLeft: -pupilW / 2 + eye.pupil.relX * irisW,
    marginTop: -pupilH / 2 + eye.pupil.relY * irisH,
    borderRadius: '50%',
    background: eye.pupil.color,
    pointerEvents: 'none',
  }

  const highlightStyle: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: highlightSize,
    height: highlightSize,
    marginLeft: -highlightSize / 2 + eye.highlight.relX * irisW,
    marginTop: -highlightSize / 2 + eye.highlight.relY * irisH,
    borderRadius: '50%',
    background: eye.highlight.color,
    pointerEvents: 'none',
  }

  return (
    <div style={irisStyle} aria-hidden="true">
      <div style={pupilStyle} />
      <div style={highlightStyle} />
    </div>
  )
}

type PuckyLoginEyesProps = {
  frameRef: RefObject<HTMLImageElement | null>
}

/**
 * DOM iris/pupil assemblies over the eyeless Pucky frame.
 * Layout of the frame/card is unchanged — this layer is measure-driven only.
 */
export function PuckyLoginEyes({ frameRef }: PuckyLoginEyesProps) {
  const [box, setBox] = useState<FrameBox | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [staticOnly, setStaticOnly] = useState(true)

  const offsetsRef = useRef<Offset[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ])
  const targetsRef = useRef<Offset[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ])
  const [, setTick] = useState(0)
  const rafRef = useRef<number | null>(null)
  const trackingActiveRef = useRef(false)
  const frameBoxRef = useRef<FrameBox | null>(null)
  const frameClientRef = useRef<DOMRect | null>(null)

  const measure = useCallback(() => {
    const frame = frameRef.current
    if (!frame) {
      setBox(null)
      frameBoxRef.current = null
      frameClientRef.current = null
      return
    }
    const stage = frame.closest('.login-pucky-stage')
    if (!stage) {
      setBox(null)
      frameBoxRef.current = null
      frameClientRef.current = null
      return
    }
    const fr = frame.getBoundingClientRect()
    const sr = stage.getBoundingClientRect()
    if (fr.width < 2 || fr.height < 2) {
      setBox(null)
      frameBoxRef.current = null
      frameClientRef.current = null
      return
    }
    const next: FrameBox = {
      left: fr.left - sr.left,
      top: fr.top - sr.top,
      width: fr.width,
      height: fr.height,
    }
    frameBoxRef.current = next
    frameClientRef.current = fr
    setBox(next)
  }, [frameRef])

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const run = () => measure()
    run()

    const ro = new ResizeObserver(run)
    ro.observe(frame)
    const stage = frame.closest('.login-pucky-stage')
    if (stage) ro.observe(stage)

    window.addEventListener('resize', run)
    frame.addEventListener('load', run)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', run)
      frame.removeEventListener('load', run)
    }
  }, [frameRef, measure])

  useEffect(() => {
    const desktopMq = window.matchMedia(
      `(min-width: ${PUCKY_EYE_TRACKING.minWidthPx}px)`,
    )
    const fineMq = window.matchMedia('(pointer: fine)')
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')

    const syncGates = () => {
      const desktop = desktopMq.matches
      setEnabled(desktop)
      const allowTrack = desktop && fineMq.matches && !motionMq.matches
      setStaticOnly(!allowTrack)
      if (!allowTrack) {
        targetsRef.current = [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ]
      }
    }

    syncGates()
    desktopMq.addEventListener('change', syncGates)
    fineMq.addEventListener('change', syncGates)
    motionMq.addEventListener('change', syncGates)
    return () => {
      desktopMq.removeEventListener('change', syncGates)
      fineMq.removeEventListener('change', syncGates)
      motionMq.removeEventListener('change', syncGates)
    }
  }, [])

  useEffect(() => {
    if (!enabled || staticOnly) {
      offsetsRef.current = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]
      targetsRef.current = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]
      trackingActiveRef.current = false
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setTick((t) => t + 1)
      return
    }

    const travelLimits = () => {
      const fr = frameClientRef.current
      const local = frameBoxRef.current
      if (!fr || !local) return null

      const gazeRefX = fr.left + PUCKY_GAZE_REF.cx * fr.width
      const gazeRefY = fr.top + PUCKY_GAZE_REF.cy * fr.height

      // Shared maxRadius from average eye size (same cap for both).
      const eyeSizes = PUCKY_EYES.map((eye) => ({
        eyeW: eye.eye.w * local.width,
        eyeH: eye.eye.h * local.height,
      }))
      const minAxis = Math.min(
        ...eyeSizes.map((e) => Math.min(e.eyeW, e.eyeH)),
      )
      const maxRadius = PUCKY_EYE_TRACKING.maxRadiusFactor * minAxis

      return PUCKY_EYES.map((eye, i) => {
        const eyeW = eye.eye.w * local.width
        const eyeH = eye.eye.h * local.height
        const irisW = eye.iris.w * local.width
        const irisH = eye.iris.h * local.height
        const baseRx =
          (eyeW / 2 - (irisW / 2) * PUCKY_EYE_TRACKING.clampIrisInset) *
          PUCKY_EYE_TRACKING.clampScale
        const baseRy =
          (eyeH / 2 - (irisH / 2) * PUCKY_EYE_TRACKING.clampIrisInset) *
          PUCKY_EYE_TRACKING.clampScale
        const innerPad = eyeW * PUCKY_EYE_TRACKING.innerEdgePadFactor
        // Beak-facing: L eye's right (+X), R eye's left (−X)
        const rxPos = i === 0 ? Math.max(0, baseRx - innerPad) : baseRx
        const rxNeg = i === 1 ? Math.max(0, baseRx - innerPad) : baseRx
        return {
          maxRadius,
          rxPos,
          rxNeg,
          ryPos: baseRy,
          ryNeg: baseRy,
          gazeRefX,
          gazeRefY,
          innerPad,
        }
      })
    }

    const setNeutralTargets = () => {
      targetsRef.current = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]
    }

    const onPointerMove = (event: PointerEvent) => {
      if (document.visibilityState === 'hidden') return
      const frame = frameRef.current
      if (frame) frameClientRef.current = frame.getBoundingClientRect()
      const live = travelLimits()
      if (!live) return

      const gazeX = event.clientX - live[0].gazeRefX
      const gazeY = event.clientY - live[0].gazeRefY

      targetsRef.current = live.map((lim) =>
        sharedGazeOffset(
          gazeX,
          gazeY,
          lim.maxRadius,
          lim.rxPos,
          lim.rxNeg,
          lim.ryPos,
          lim.ryNeg,
        ),
      )
    }

    const onLeaveOrBlur = () => setNeutralTargets()

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        trackingActiveRef.current = false
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      } else if (!rafRef.current) {
        trackingActiveRef.current = true
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    const tick = () => {
      if (document.visibilityState === 'hidden') {
        rafRef.current = null
        trackingActiveRef.current = false
        return
      }
      const alpha = PUCKY_EYE_TRACKING.lerpAlpha
      let moved = false
      for (let i = 0; i < 2; i++) {
        const cur = offsetsRef.current[i]
        const tgt = targetsRef.current[i]
        const nx = cur.x + (tgt.x - cur.x) * alpha
        const ny = cur.y + (tgt.y - cur.y) * alpha
        if (Math.abs(nx - cur.x) > 0.01 || Math.abs(ny - cur.y) > 0.01) moved = true
        offsetsRef.current[i] = { x: nx, y: ny }
      }
      if (moved || Math.hypot(targetsRef.current[0].x, targetsRef.current[0].y) > 0.01) {
        setTick((t) => t + 1)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    trackingActiveRef.current = true
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('blur', onLeaveOrBlur)
    document.documentElement.addEventListener('mouseleave', onLeaveOrBlur)
    document.addEventListener('visibilitychange', onVisibility)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      trackingActiveRef.current = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('blur', onLeaveOrBlur)
      document.documentElement.removeEventListener('mouseleave', onLeaveOrBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [enabled, staticOnly, frameRef])

  if (!enabled || !box) return null

  const layerStyle: CSSProperties = {
    position: 'absolute',
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    zIndex: 21,
    pointerEvents: 'none',
    overflow: 'visible',
  }

  return (
    <div className="login-pucky-eyes" style={layerStyle} aria-hidden="true">
      {PUCKY_EYES.map((eye, i) => (
        <IrisAssembly
          key={i}
          eye={eye}
          box={box}
          offset={staticOnly ? { x: 0, y: 0 } : offsetsRef.current[i]}
        />
      ))}
    </div>
  )
}
