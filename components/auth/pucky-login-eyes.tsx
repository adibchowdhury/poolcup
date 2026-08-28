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
  sharedGazeOffsets,
  type PuckyEyeCalibration,
} from '@/src/lib/pucky-eye-calibration'

type FrameBox = {
  left: number
  top: number
  width: number
  height: number
}

type Offset = { x: number; y: number }

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
 * ONE shared atan2(cursor − imageCenter); per-eye LUT magnitude; near-face dead-zone.
 */
export function PuckyLoginEyes({ frameRef }: PuckyLoginEyesProps) {
  const [box, setBox] = useState<FrameBox | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [staticOnly, setStaticOnly] = useState(true)

  const offsetRef = useRef<Offset[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ])
  const targetRef = useRef<Offset[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ])
  const [, setTick] = useState(0)
  const rafRef = useRef<number | null>(null)
  const frameBoxRef = useRef<FrameBox | null>(null)

  const measure = useCallback(() => {
    const frame = frameRef.current
    if (!frame) {
      setBox(null)
      frameBoxRef.current = null
      return
    }
    const stage = frame.closest('.login-pucky-stage')
    if (!(stage instanceof HTMLElement)) {
      setBox(null)
      frameBoxRef.current = null
      return
    }
    // Layout (pre-transform) size — CSS left/top/width for iris overlays.
    // getBoundingClientRect is post-transform and would desync under stage scale().
    const sr = stage.getBoundingClientRect()
    const fr = frame.getBoundingClientRect()
    const scaleX = stage.offsetWidth > 0 ? sr.width / stage.offsetWidth : 1
    const scaleY = stage.offsetHeight > 0 ? sr.height / stage.offsetHeight : 1
    if (scaleX < 1e-6 || scaleY < 1e-6 || fr.width < 2 || fr.height < 2) {
      setBox(null)
      frameBoxRef.current = null
      return
    }
    const next: FrameBox = {
      left: (fr.left - sr.left) / scaleX,
      top: (fr.top - sr.top) / scaleY,
      width: fr.width / scaleX,
      height: fr.height / scaleY,
    }
    frameBoxRef.current = next
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
        targetRef.current = [
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
      offsetRef.current = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]
      targetRef.current = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setTick((t) => t + 1)
      return
    }

    const setNeutralTarget = () => {
      targetRef.current = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]
    }

    const onPointerMove = (event: PointerEvent) => {
      if (document.visibilityState === 'hidden') return
      const frame = frameRef.current
      const local = frameBoxRef.current
      if (!frame || !local) return
      // Screen-space center for shared atan2; layout width for LUT magnitudes (CSS px).
      const fr = frame.getBoundingClientRect()
      const cx = fr.left + fr.width / 2
      const cy = fr.top + fr.height / 2
      targetRef.current = sharedGazeOffsets(
        event.clientX,
        event.clientY,
        cx,
        cy,
        local.width,
      )
    }

    const onLeaveOrBlur = () => setNeutralTarget()

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      } else if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    const tick = () => {
      if (document.visibilityState === 'hidden') {
        rafRef.current = null
        return
      }
      const alpha = PUCKY_EYE_TRACKING.lerpAlpha
      let moved = false
      for (let i = 0; i < 2; i++) {
        const cur = offsetRef.current[i]
        const tgt = targetRef.current[i]
        const nx = cur.x + (tgt.x - cur.x) * alpha
        const ny = cur.y + (tgt.y - cur.y) * alpha
        if (Math.abs(nx - cur.x) > 0.01 || Math.abs(ny - cur.y) > 0.01) moved = true
        offsetRef.current[i] = { x: nx, y: ny }
      }
      if (moved || Math.hypot(targetRef.current[0].x, targetRef.current[0].y) > 0.01) {
        setTick((t) => t + 1)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('blur', onLeaveOrBlur)
    document.documentElement.addEventListener('mouseleave', onLeaveOrBlur)
    document.addEventListener('visibilitychange', onVisibility)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
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

  const zero = { x: 0, y: 0 }

  return (
    <div className="login-pucky-eyes" style={layerStyle} aria-hidden="true">
      {PUCKY_EYES.map((eye, i) => (
        <IrisAssembly
          key={i}
          eye={eye}
          box={box}
          offset={staticOnly ? zero : offsetRef.current[i]}
        />
      ))}
    </div>
  )
}
