/**
 * Re-runnable Pucky eye socket + neutral measure.
 * Radial boundary LUT from eyeless PNG; neutrals from original.
 *
 * Usage: node scripts/measure-pucky-eye-lut.mjs
 */
import sharp from 'sharp'
import fs from 'fs'

const ASSET_W = 1536
const ASSET_H = 1024
const LUT_ANGLES = 64
/**
 * Art check: authored iris ellipse idle slack ≈ 0.3px @368; dark pixels
 * touch/slightly cross the raycast outline. Safety reduced to what the art permits.
 */
const SAFETY_AT_368 = 0.5
const SAFETY_ASSET = (SAFETY_AT_368 / 368) * ASSET_W
/** Outward (away-from-beak) DOM neutral bias @368px render → buys inward slack. */
const NEUTRAL_BIAS_PX_368 = 2
const NEUTRAL_BIAS_ASSET = (NEUTRAL_BIAS_PX_368 / 368) * ASSET_W
/** Shared-gaze travel cap (px @368). */
const MAX_GAZE_PX_368 = 4
const MAX_GAZE_ASSET = (MAX_GAZE_PX_368 / 368) * ASSET_W
/** Hard cap on ray length — prevents face-white leakage past broken outline gaps. */
const RAY_CAP_ASSET = 80
const IRIS_SIZE = {
  L: { w: 0.0529, h: 0.0877 },
  R: { w: 0.0554, h: 0.0867 },
}
const OLD_NEUTRAL = {
  L: { cx: 0.4215, cy: 0.4385 },
  R: { cx: 0.5687, cy: 0.439 },
}
const AUTHORED_NEUTRAL = {
  L: { cx: 0.4215, cy: 0.4385 },
  R: { cx: 0.5687, cy: 0.439 },
}

async function load(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height }
}

const orig = await load('public/login_assets/pucky-login-frame.png')
const eye = await load('public/login_assets/pucky-login-frame-eyeless.png')

const at = (img, x, y) => {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return { r: 0, g: 0, b: 0, a: 0 }
  const i = (y * img.w + x) * 4
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] }
}

const isDark = (c) => c.a > 200 && c.r < 55 && c.g < 50 && c.b < 50
const isSclera = (c) => {
  if (c.a < 200) return false
  const L = (c.r + c.g + c.b) / 3
  return L > 155 && c.r > 145 && c.g > 135 && c.b > 120 && c.r >= c.b - 20
}
const isOutline = (c) => c.a > 200 && c.r < 70 && c.g < 65 && c.b < 65

function measureNeutral(x0, x1, y0, y1, seedX, seedY) {
  const pts = []
  const seen = new Set()
  const q = [[Math.round(seedX), Math.round(seedY)]]
  seen.add(q[0].join(','))
  while (q.length) {
    const [x, y] = q.pop()
    if (x < x0 || x > x1 || y < y0 || y > y1) continue
    const o = at(orig, x, y)
    const e = at(eye, x, y)
    if (!(isDark(o) && !isDark(e))) continue
    pts.push({ x, y })
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx
        const ny = y + dy
        const k = nx + ',' + ny
        if (seen.has(k)) continue
        seen.add(k)
        q.push([nx, ny])
      }
    }
  }
  let sx = 0
  let sy = 0
  for (const p of pts) {
    sx += p.x
    sy += p.y
  }
  const dcx = sx / pts.length
  const dcy = sy / pts.length
  const dists = pts.map((p) => Math.hypot(p.x - dcx, p.y - dcy)).sort((a, b) => a - b)
  const rCut = dists[Math.floor(dists.length * 0.96)]
  const core = pts.filter((p) => Math.hypot(p.x - dcx, p.y - dcy) <= rCut)
  let minX = 1e9
  let maxX = 0
  let minY = 1e9
  let maxY = 0
  let csx = 0
  let csy = 0
  for (const p of core) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
    csx += p.x
    csy += p.y
  }
  return {
    densCx: csx / core.length,
    densCy: csy / core.length,
    bboxCx: (minX + maxX) / 2,
    bboxCy: (minY + maxY) / 2,
    n: core.length,
    dens: { cx: csx / core.length, cy: csy / core.length },
  }
}

function irisExtentAtAngle(wF, hF, angle) {
  const rx = (wF * ASSET_W) / 2
  const ry = (hF * ASSET_H) / 2
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return (rx * ry) / Math.hypot(ry * c, rx * s)
}

/** Ray-cast on eyeless: stop at outline / non-sclera / cap. No flood (avoids face leak). */
function rayBoundary(cx, cy, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  let hit = 0
  for (let r = 1; r <= RAY_CAP_ASSET; r++) {
    const x = Math.round(cx + cos * r)
    const y = Math.round(cy + sin * r)
    if (x < 0 || y < 0 || x >= ASSET_W || y >= ASSET_H) return r - 1
    const c = at(eye, x, y)
    if (isOutline(c) || !isSclera(c)) return r - 1
    hit = r
  }
  return hit
}

function interpBoundary(boundary, angle) {
  const n = boundary.length
  let a = angle % (Math.PI * 2)
  if (a < 0) a += Math.PI * 2
  const t = (a / (Math.PI * 2)) * n
  const i0 = Math.floor(t) % n
  const i1 = (i0 + 1) % n
  const frac = t - Math.floor(t)
  return boundary[i0] + (boundary[i1] - boundary[i0]) * frac
}

/**
 * Max center travel in direction θ such that the WHOLE iris ellipse stays inside
 * the socket for every edge sample. Margin is min(safety, idleSlack) so authored
 * near-touch idle states still allow a visible gap when moving.
 */
function maxLegalTravel(neutralCx, neutralCy, irisSize, boundary, theta) {
  const ux = Math.cos(theta)
  const uy = Math.sin(theta)
  const edgeN = 48

  function minSlack(t) {
    let slack = Infinity
    for (let i = 0; i < edgeN; i++) {
      const alpha = (i / edgeN) * Math.PI * 2
      const ext = irisExtentAtAngle(irisSize.w, irisSize.h, alpha)
      const ex = t * ux + Math.cos(alpha) * ext
      const ey = t * uy + Math.sin(alpha) * ext
      const dist = Math.hypot(ex, ey)
      const bAng = Math.atan2(ey, ex)
      const bound = interpBoundary(boundary, bAng)
      slack = Math.min(slack, bound - dist)
    }
    return slack
  }

  const idleSlack = minSlack(0)
  // Require this much remaining socket past the iris edge (px in asset space).
  const need = Math.min(SAFETY_ASSET, Math.max(0, idleSlack - 0.5))

  let lo = 0
  let hi = interpBoundary(boundary, theta)
  for (let iter = 0; iter < 18; iter++) {
    const mid = (lo + hi) / 2
    if (minSlack(mid) >= need - 0.15) lo = mid
    else hi = mid
  }
  return Math.max(0, lo)
}

function buildLut(neutralCx, neutralCy, irisSize) {
  const boundary = []
  for (let i = 0; i < LUT_ANGLES; i++) {
    const angle = (i / LUT_ANGLES) * Math.PI * 2
    boundary.push(rayBoundary(neutralCx, neutralCy, angle))
  }
  const legal = []
  for (let i = 0; i < LUT_ANGLES; i++) {
    const angle = (i / LUT_ANGLES) * Math.PI * 2
    legal.push(maxLegalTravel(neutralCx, neutralCy, irisSize, boundary, angle))
  }
  return { boundary, legal }
}

function lutStats(lut, label) {
  const legal = lut.legal
  let min = Infinity
  let max = -Infinity
  let minI = 0
  let maxI = 0
  for (let i = 0; i < legal.length; i++) {
    if (legal[i] < min) {
      min = legal[i]
      minI = i
    }
    if (legal[i] > max) {
      max = legal[i]
      maxI = i
    }
  }
  const toDeg = (i) => +((i / LUT_ANGLES) * 360).toFixed(1)
  const scale = 368 / ASSET_W
  // Top-K tightest angles
  const ranked = legal
    .map((v, i) => ({ v, i, deg: toDeg(i) }))
    .sort((a, b) => a.v - b.v)
  return {
    label,
    angles: LUT_ANGLES,
    legalAsset: { min: +min.toFixed(2), max: +max.toFixed(2) },
    legalPx368: { min: +(min * scale).toFixed(2), max: +(max * scale).toFixed(2) },
    tightestAngleDeg: toDeg(minI),
    widestAngleDeg: toDeg(maxI),
    tightest5: ranked.slice(0, 5).map((r) => ({ deg: r.deg, legalPx: +(r.v * scale).toFixed(2) })),
    boundaryAsset: {
      min: +Math.min(...lut.boundary).toFixed(2),
      max: +Math.max(...lut.boundary).toFixed(2),
    },
    boundaryPx368: {
      min: +((Math.min(...lut.boundary) * scale).toFixed(2)),
      max: +((Math.max(...lut.boundary) * scale).toFixed(2)),
    },
  }
}

// Seeds: dark core of each eye on original
const neuL = measureNeutral(560, 720, 370, 520, 635, 440)
const neuR = measureNeutral(800, 980, 370, 520, 870, 450)

// Bbox center of eyeless-diff assembly = visual iris disc center
const authoredL = { cx: neuL.bboxCx, cy: neuL.bboxCy }
const authoredR = { cx: neuR.bboxCx, cy: neuR.bboxCy }

// Outward bias: L ← left, R → right (away from beak)
const biasedL = { cx: authoredL.cx - NEUTRAL_BIAS_ASSET, cy: authoredL.cy }
const biasedR = { cx: authoredR.cx + NEUTRAL_BIAS_ASSET, cy: authoredR.cy }

const neutralL = { cx: biasedL.cx / ASSET_W, cy: biasedL.cy / ASSET_H }
const neutralR = { cx: biasedR.cx / ASSET_W, cy: biasedR.cy / ASSET_H }

const lutL = buildLut(biasedL.cx, biasedL.cy, IRIS_SIZE.L)
const lutR = buildLut(biasedR.cx, biasedR.cy, IRIS_SIZE.R)

const statsL = lutStats(lutL, 'L')
const statsR = lutStats(lutR, 'R')

// Shared legal = min(L, R, maxGaze) — both eyes get identical travel
const sharedLegal = lutL.legal.map((l, i) => Math.min(l, lutR.legal[i], MAX_GAZE_ASSET))
const sharedStats = (() => {
  const scale = 368 / ASSET_W
  const px = sharedLegal.map((v) => v * scale)
  const at = (deg) => {
    const ang = (deg * Math.PI) / 180
    const n = sharedLegal.length
    let a = ang % (Math.PI * 2)
    if (a < 0) a += Math.PI * 2
    const t = (a / (Math.PI * 2)) * n
    const i0 = Math.floor(t) % n
    const i1 = (i0 + 1) % n
    const f = t - Math.floor(t)
    return (sharedLegal[i0] + (sharedLegal[i1] - sharedLegal[i0]) * f) * scale
  }
  return {
    minPx368: +Math.min(...px).toFixed(2),
    maxPx368: +Math.max(...px).toFixed(2),
    byDirectionPx368: {
      right: +at(0).toFixed(2),
      up: +at(90).toFixed(2),
      left: +at(180).toFixed(2),
      down: +at(270).toFixed(2),
      beakwardApprox: +Math.min(at(0), at(180)).toFixed(2),
    },
  }
})()

const embed = {
  angleCount: LUT_ANGLES,
  safetyWidthFraction: SAFETY_AT_368 / 368,
  safetyAt368Px: SAFETY_AT_368,
  neutralBiasPx368: NEUTRAL_BIAS_PX_368,
  maxGazePx368: MAX_GAZE_PX_368,
  artIdleFinding:
    'authored iris abuts/near-touches inner boundary (~0.3px ellipse slack @368; dark pixels touch outline)',
  rayCapWidthFraction: RAY_CAP_ASSET / ASSET_W,
  authoredNeutrals: {
    L: {
      cx: +(authoredL.cx / ASSET_W).toFixed(4),
      cy: +(authoredL.cy / ASSET_H).toFixed(4),
    },
    R: {
      cx: +(authoredR.cx / ASSET_W).toFixed(4),
      cy: +(authoredR.cy / ASSET_H).toFixed(4),
    },
  },
  neutrals: {
    L: { cx: +neutralL.cx.toFixed(4), cy: +neutralL.cy.toFixed(4) },
    R: { cx: +neutralR.cx.toFixed(4), cy: +neutralR.cy.toFixed(4) },
  },
  /** Max legal iris-CENTER offset as fraction of frame width, 64 angles from +X CCW. */
  legalL: lutL.legal.map((r) => +(r / ASSET_W).toFixed(6)),
  legalR: lutR.legal.map((r) => +(r / ASSET_W).toFixed(6)),
  /** Shared = min(legalL, legalR, maxGaze) — runtime travel table. */
  sharedLegal: sharedLegal.map((r) => +(r / ASSET_W).toFixed(6)),
  /** Socket boundary (center → outline) as fraction of frame width (biased neutrals). */
  boundaryL: lutL.boundary.map((r) => +(r / ASSET_W).toFixed(6)),
  boundaryR: lutR.boundary.map((r) => +(r / ASSET_W).toFixed(6)),
  irisSize: IRIS_SIZE,
  stats: { L: statsL, R: statsR, shared: sharedStats },
  deltaFromOld: {
    L: {
      dcx: +(neutralL.cx - OLD_NEUTRAL.L.cx).toFixed(4),
      dcy: +(neutralL.cy - OLD_NEUTRAL.L.cy).toFixed(4),
    },
    R: {
      dcx: +(neutralR.cx - OLD_NEUTRAL.R.cx).toFixed(4),
      dcy: +(neutralR.cy - OLD_NEUTRAL.R.cy).toFixed(4),
    },
  },
}

fs.mkdirSync('scripts/.screenshots', { recursive: true })
fs.writeFileSync('scripts/.screenshots/pucky-eye-lut-embed.json', JSON.stringify(embed, null, 2))
fs.writeFileSync(
  'scripts/.screenshots/pucky-eye-lut.json',
  JSON.stringify({ ...embed, oldNeutral: OLD_NEUTRAL, authoredNeutral: AUTHORED_NEUTRAL }, null, 2),
)

console.log(
  JSON.stringify(
    {
      neutrals: embed.neutrals,
      authoredNeutrals: embed.authoredNeutrals,
      neutralBiasPx368: NEUTRAL_BIAS_PX_368,
      safetyAt368Px: SAFETY_AT_368,
      deltaFromOld: embed.deltaFromOld,
      stats: embed.stats,
    },
    null,
    2,
  ),
)
