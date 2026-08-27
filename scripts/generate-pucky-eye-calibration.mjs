/**
 * Regenerates src/lib/pucky-eye-calibration.ts from the LUT embed JSON.
 * Run after: node scripts/measure-pucky-eye-lut.mjs
 *
 * Runtime: shared atan2 + dist(angle)=min(L,R,maxGaze) from LUT.
 */
import fs from 'fs'

const e = JSON.parse(fs.readFileSync('scripts/.screenshots/pucky-eye-lut-embed.json', 'utf8'))
const arr = (a) => a.map((v) => Number(v).toFixed(6)).join(', ')

const ts = `/**
 * Asset-derived eye calibration for Pucky login tracking.
 *
 * Runtime: one shared atan2 from image center; offset = dir × dist(angle)
 * where dist = min(legalL, legalR, maxGazePx) via interpolated LUT.
 * Neutrals include an outward bias (away from beak) for inward slack.
 *
 * Refresh LUT via:
 *   node scripts/measure-pucky-eye-lut.mjs
 *   node scripts/generate-pucky-eye-calibration.mjs
 */

export const PUCKY_EYE_ASSET = {
  width: 1536,
  height: 1024,
  eyelessSrc: '/login_assets/pucky-login-frame-eyeless.png',
  referenceSrc: '/login_assets/pucky-login-frame.png',
} as const

export const PUCKY_EYE_LUT_ANGLE_COUNT = ${e.angleCount} as const

export type PuckyEyeCalibration = {
  iris: {
    cx: number
    cy: number
    w: number
    h: number
    color: string
  }
  pupil: {
    relW: number
    relH: number
    relX: number
    relY: number
    color: string
  }
  highlight: {
    relX: number
    relY: number
    sizeVsIris: number
    color: string
  }
  /** Max legal iris-CENTER offset (fraction of frame width), 64 angles from +X CCW. */
  legalRadiusWidthFractions: readonly number[]
  /** Socket boundary (center → outline) as fraction of frame width. */
  boundaryWidthFractions: readonly number[]
}

export const PUCKY_EYE_TRACKING = {
  /** Safety gap iris-edge → outline (@368px). Art abuts boundary; reduced from 3px. */
  safetyWidthFraction: ${e.safetyWidthFraction},
  safetyAt368Px: ${e.safetyAt368Px},
  /** Outward (away-from-beak) neutral shift @368px render. */
  neutralBiasPx368: ${e.neutralBiasPx368},
  /** Cap on shared gaze travel @368px. */
  maxGazePx368: ${e.maxGazePx368},
  /**
   * Near-face dead-zone: radius = this × eye-span ( |R.cx−L.cx| × frameW ).
   * Inside: smoothstep-blend gaze magnitude toward 0 (looking straight ahead).
   */
  faceDeadZoneEyeSpanMul: 1.2,
  lerpAlpha: 0.18,
  minWidthPx: 1024,
} as const

/** Shared travel table: min(legalL, legalR, maxGaze) as width fractions. */
export const PUCKY_SHARED_LEGAL_WIDTH_FRACTIONS = [${arr(e.sharedLegal)}] as const

export const PUCKY_LEFT_EYE: PuckyEyeCalibration = {
  iris: {
    cx: ${e.neutrals.L.cx},
    cy: ${e.neutrals.L.cy},
    w: ${e.irisSize.L.w},
    h: ${e.irisSize.L.h},
    color: '#0b0604',
  },
  pupil: { relW: 0.72, relH: 0.72, relX: 0, relY: 0.02, color: '#010101' },
  highlight: {
    relX: -0.343,
    relY: -0.358,
    sizeVsIris: 0.14,
    color: 'rgba(255,255,255,0.95)',
  },
  legalRadiusWidthFractions: [${arr(e.legalL)}],
  boundaryWidthFractions: [${arr(e.boundaryL)}],
}

export const PUCKY_RIGHT_EYE: PuckyEyeCalibration = {
  iris: {
    cx: ${e.neutrals.R.cx},
    cy: ${e.neutrals.R.cy},
    w: ${e.irisSize.R.w},
    h: ${e.irisSize.R.h},
    color: '#070706',
  },
  pupil: { relW: 0.72, relH: 0.72, relX: 0, relY: 0.02, color: '#030303' },
  highlight: {
    relX: -0.12,
    relY: -0.36,
    sizeVsIris: 0.14,
    color: 'rgba(255,255,255,0.95)',
  },
  legalRadiusWidthFractions: [${arr(e.legalR)}],
  boundaryWidthFractions: [${arr(e.boundaryR)}],
}

export const PUCKY_EYES = [PUCKY_LEFT_EYE, PUCKY_RIGHT_EYE] as const

/** Interpolate a width-fraction LUT to px at frameWidth. */
export function radiusAtAngle(
  fractions: readonly number[],
  angleRad: number,
  frameWidth: number,
): number {
  const n = fractions.length
  let a = angleRad % (Math.PI * 2)
  if (a < 0) a += Math.PI * 2
  const t = (a / (Math.PI * 2)) * n
  const i0 = Math.floor(t) % n
  const i1 = (i0 + 1) % n
  const frac = t - Math.floor(t)
  return (fractions[i0] + (fractions[i1] - fractions[i0]) * frac) * frameWidth
}

/**
 * Shared-direction, per-eye magnitude gaze.
 * ONE atan2(cursor − imageCenter) — never per-eye angles.
 * Each eye: offset = thatDir × min(legal_thisEye(θ), maxGaze) × deadZoneScale.
 */
export function sharedGazeOffsets(
  cursorX: number,
  cursorY: number,
  imageCenterX: number,
  imageCenterY: number,
  frameWidth: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  const dx = cursorX - imageCenterX
  const dy = cursorY - imageCenterY
  const faceDist = Math.hypot(dx, dy)

  const eyeSpan =
    Math.abs(PUCKY_RIGHT_EYE.iris.cx - PUCKY_LEFT_EYE.iris.cx) * frameWidth
  const deadR = eyeSpan * PUCKY_EYE_TRACKING.faceDeadZoneEyeSpanMul
  let magScale = 1
  if (deadR > 1e-6) {
    const t = Math.min(1, Math.max(0, faceDist / deadR))
    magScale = t * t * (3 - 2 * t)
  }
  if (faceDist < 1e-6 || magScale < 1e-6) {
    return [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]
  }

  const angle = Math.atan2(dy, dx)
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)
  const maxGaze = PUCKY_EYE_TRACKING.maxGazePx368 * (frameWidth / 368)

  return PUCKY_EYES.map((eye) => {
    const dist =
      Math.min(
        radiusAtAngle(eye.legalRadiusWidthFractions, angle, frameWidth),
        maxGaze,
      ) * magScale
    return { x: dirX * dist, y: dirY * dist }
  }) as [{ x: number; y: number }, { x: number; y: number }]
}
`

fs.writeFileSync('src/lib/pucky-eye-calibration.ts', ts)
console.log('wrote src/lib/pucky-eye-calibration.ts', {
  bias: e.neutralBiasPx368,
  safety: e.safetyAt368Px,
  shared: e.stats.shared,
})
