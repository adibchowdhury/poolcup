/**
 * Asset-derived eye calibration for Pucky login tracking.
 *
 * Source assets (do not modify):
 * - public/login_assets/pucky-login-frame.png (reference / fallback)
 * - public/login_assets/pucky-login-frame-eyeless.png (displayed base)
 *
 * Canvas: 1536×1024 (identical for both PNGs).
 *
 * Iris assembly = pixels dark on the original and not dark on the eyeless
 * export (true authored disc; excludes brow/outline bleed from a naive flood).
 * Investigation §2 “pupil” figures (~0.077×0.119) were flood-inflated by
 * surrounding black fur — full-assembly bounds here are tighter.
 *
 * Diff check: opaque body outside the eye band → 0 differing samples
 * (same canvas; sclera/outline unchanged). Eye-band diffs are the removed
 * iris holes only.
 */

export const PUCKY_EYE_ASSET = {
  width: 1536,
  height: 1024,
  /** Displayed login frame (eyes removed). */
  eyelessSrc: '/login_assets/pucky-login-frame-eyeless.png',
  /** Original baked-eye reference (idle QA / fallback). */
  referenceSrc: '/login_assets/pucky-login-frame.png',
} as const

/** One eye: fractions of the asset canvas. */
export type PuckyEyeCalibration = {
  /** Neutral center of the dark iris/pupil assembly. */
  iris: {
    cx: number
    cy: number
    w: number
    h: number
    /** Sampled charcoal from outer assembly ring. */
    color: string
  }
  /** Inner pupil disc, relative to iris box (0–1 of iris w/h, center-relative). */
  pupil: {
    relW: number
    relH: number
    relX: number
    relY: number
    color: string
  }
  /** Specular highlight, relative to iris box; moves with the assembly. */
  highlight: {
    relX: number
    relY: number
    /** Diameter as fraction of min(iris.w, iris.h) in asset space. */
    sizeVsIris: number
    color: string
  }
  /**
   * Sclera / eye-white ellipse (investigation half-plane measure).
   * Used for elliptical travel clamp: rx,ry = eyeRadii − irisRadii×0.9
   */
  eye: {
    cx: number
    cy: number
    w: number
    h: number
  }
}

/**
 * Tracking constants (behavior pass).
 * maxRadius was 0.11 × eye min-axis (~5.3px at 368px); reduced ~30%.
 */
export const PUCKY_EYE_TRACKING = {
  /** Cap travel as a fraction of min(rendered eyeW, eyeH). Was 0.11 → 0.077 (−30%). */
  maxRadiusFactor: 0.077,
  /** Iris inset when deriving ellipse clamp radii. Was 0.9 → 1.05 (tighter). */
  clampIrisInset: 1.05,
  /**
   * Extra shrink on the elliptical travel bounds (after iris inset).
   * Was effectively 1.0 → 0.78 (−22% on clamp radii).
   */
  clampScale: 0.78,
  /**
   * Extra inward (beak-facing) pad as a fraction of rendered eye width.
   * L: reduces +X travel; R: reduces −X travel. ≈ 0.06 × 47.8px ≈ 2.9px at 368.
   */
  innerEdgePadFactor: 0.06,
  /** Per-frame lerp toward target (rAF). */
  lerpAlpha: 0.18,
  /** Desktop gate — matches `.login-pucky-frame` visibility. */
  minWidthPx: 1024,
} as const

/**
 * Shared gaze reference = midpoint of the two iris neutral centers (face center).
 * Cursor is measured against this single point; the same vector is applied to both eyes.
 */
export const PUCKY_GAZE_REF = {
  cx: (0.4215 + 0.5687) / 2, // 0.4951
  cy: (0.4385 + 0.439) / 2, // 0.43875
} as const

/**
 * Iris w/h: measured assembly × 1.08 AA pad × 0.875 (−12.5% behavior shrink).
 * Neutral centers unchanged.
 */
export const PUCKY_LEFT_EYE: PuckyEyeCalibration = {
  iris: {
    cx: 0.4215,
    cy: 0.4385,
    w: 0.0529, // was 0.0605 (−12.5%)
    h: 0.0877, // was 0.1002 (−12.5%)
    color: '#0b0604',
  },
  pupil: {
    relW: 0.72,
    relH: 0.72,
    relX: 0,
    relY: 0.02,
    color: '#010101',
  },
  highlight: {
    // Specular cluster ≈ asset (0.4023, 0.4053)
    relX: -0.343,
    relY: -0.358,
    sizeVsIris: 0.14,
    color: 'rgba(255,255,255,0.95)',
  },
  eye: {
    // Investigation §2 eye-white ellipse (half-plane white sampling)
    cx: 0.392,
    cy: 0.464,
    w: 0.13,
    h: 0.253,
  },
}

export const PUCKY_RIGHT_EYE: PuckyEyeCalibration = {
  iris: {
    cx: 0.5687,
    cy: 0.439,
    w: 0.0554, // was 0.0633 (−12.5%)
    h: 0.0867, // was 0.0991 (−12.5%)
    color: '#070706',
  },
  pupil: {
    relW: 0.72,
    relH: 0.72,
    relX: 0,
    relY: 0.02,
    color: '#030303',
  },
  highlight: {
    // Measured specular ≈ (0.5732, 0.4072); nudge left to match authored glint
    relX: -0.12,
    relY: -0.36,
    sizeVsIris: 0.14,
    color: 'rgba(255,255,255,0.95)',
  },
  eye: {
    cx: 0.596,
    cy: 0.465,
    w: 0.131,
    h: 0.254,
  },
}

export const PUCKY_EYES = [PUCKY_LEFT_EYE, PUCKY_RIGHT_EYE] as const
