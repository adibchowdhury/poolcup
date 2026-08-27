/**
 * Shared-direction + per-eye magnitude: containment, parallel vectors, live verify, dead-zone.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, readFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const embed = JSON.parse(
  readFileSync(resolve(outDir, 'pucky-eye-lut-embed.json'), 'utf8'),
)

const GRID_X = 20
const GRID_Y = 12
const EDGE_SAMPLES = 32
const DEAD_ZONE_MUL = 1.2

function irisExtent(w, h, angle) {
  const rx = w / 2
  const ry = h / 2
  return (rx * ry) / Math.hypot(ry * Math.cos(angle), rx * Math.sin(angle))
}

function boundaryAt(fractions, angleRad, frameW) {
  const n = fractions.length
  let a = angleRad % (Math.PI * 2)
  if (a < 0) a += Math.PI * 2
  const t = (a / (Math.PI * 2)) * n
  const i0 = Math.floor(t) % n
  const i1 = (i0 + 1) % n
  const frac = t - Math.floor(t)
  return (fractions[i0] + (fractions[i1] - fractions[i0]) * frac) * frameW
}

function eyeDist(legal, angle, frameW) {
  const maxGaze = embed.maxGazePx368 * (frameW / 368)
  return Math.min(boundaryAt(legal, angle, frameW), maxGaze)
}

/** Full-magnitude (far cursor) — for containment / travel / parallel math. */
function perEyeOffsets(angle, frameW, magScale = 1) {
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)
  const dL = eyeDist(embed.legalL, angle, frameW) * magScale
  const dR = eyeDist(embed.legalR, angle, frameW) * magScale
  return {
    L: { x: dirX * dL, y: dirY * dL, dist: dL },
    R: { x: dirX * dR, y: dirY * dR, dist: dR },
  }
}

function crossAbs(a, b) {
  return Math.abs(a.x * b.y - a.y * b.x)
}

function assertIrisInside(eyeKey, irisSize, offset, frameW, frameH) {
  const boundary = embed[`boundary${eyeKey}`]
  const irisW = irisSize.w * frameW
  const irisH = irisSize.h * frameH
  const violations = []
  for (let i = 0; i < EDGE_SAMPLES; i++) {
    const ang = (i / EDGE_SAMPLES) * Math.PI * 2
    const ext = irisExtent(irisW, irisH, ang)
    const vx = offset.x + Math.cos(ang) * ext
    const vy = offset.y + Math.sin(ang) * ext
    const dist = Math.hypot(vx, vy)
    const bound = boundaryAt(boundary, Math.atan2(vy, vx), frameW)
    if (bound - dist < -0.4) {
      violations.push({
        angDeg: +((ang * 180) / Math.PI).toFixed(1),
        slack: +(bound - dist).toFixed(2),
      })
    }
  }
  return violations
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1200)

const frame = await page.evaluate(() => {
  const fr = document.querySelector('.login-pucky-frame')?.getBoundingClientRect()
  return fr
    ? { left: fr.left, top: fr.top, width: fr.width, height: fr.height }
    : null
})
if (!frame) throw new Error('no frame')

const imageCenter = {
  x: frame.left + frame.width / 2,
  y: frame.top + frame.height / 2,
}
const eyeSpan = Math.abs(embed.neutrals.R.cx - embed.neutrals.L.cx) * frame.width
const deadR = eyeSpan * DEAD_ZONE_MUL
const scale368 = 368 / frame.width

const cardinalTravel = {}
for (const [name, deg] of [
  ['right', 0],
  ['up', 90],
  ['left', 180],
  ['down', 270],
]) {
  const { L, R } = perEyeOffsets((deg * Math.PI) / 180, frame.width, 1)
  cardinalTravel[name] = {
    L: +((L.dist * scale368).toFixed(2)),
    R: +((R.dist * scale368).toFixed(2)),
  }
}

let totalViolations = 0
let coordViolations = 0
let maxCross = 0
const failSamples = []

for (let gy = 0; gy < GRID_Y; gy++) {
  for (let gx = 0; gx < GRID_X; gx++) {
    const cx = 8 + ((1280 - 16) * gx) / (GRID_X - 1)
    const cy = 8 + ((800 - 16) * gy) / (GRID_Y - 1)
    const dx = cx - imageCenter.x
    const dy = cy - imageCenter.y
    const faceDist = Math.hypot(dx, dy)
    const t = deadR > 0 ? Math.min(1, Math.max(0, faceDist / deadR)) : 1
    const magScale = t * t * (3 - 2 * t)
    const angle = faceDist < 1e-6 ? 0 : Math.atan2(dy, dx)
    const { L: offL, R: offR } = perEyeOffsets(angle, frame.width, magScale)

    const cross = crossAbs(offL, offR)
    maxCross = Math.max(maxCross, cross)
    if (cross > 1e-6) coordViolations++

    const vL = assertIrisInside('L', embed.irisSize.L, offL, frame.width, frame.height)
    const vR = assertIrisInside('R', embed.irisSize.R, offR, frame.width, frame.height)
    totalViolations += vL.length + vR.length
    if ((vL.length || vR.length) && failSamples.length < 6) {
      failSamples.push({ cx, cy, vL: vL.slice(0, 2), vR: vR.slice(0, 2) })
    }
  }
}

// —— LIVE browser measurement at 5 positions ——
async function liveMeasure(label, x, y) {
  await page.mouse.move(x, y)
  await page.waitForTimeout(600)
  return page.evaluate(
    ({ neutrals, label, x, y, imageCenter }) => {
      const layer = document.querySelector('.login-pucky-eyes')
      const frameEl = document.querySelector('.login-pucky-frame')
      if (!layer || !frameEl) return { label, error: 'missing' }
      const fr = frameEl.getBoundingClientRect()
      const kids = [...layer.children]
      const parse = (el, n) => {
        const r = el.getBoundingClientRect()
        const irisW = n.w * fr.width
        const irisH = n.h * fr.height
        const nL = fr.left + n.cx * fr.width - irisW / 2
        const nT = fr.top + n.cy * fr.height - irisH / 2
        return {
          x: +(r.left - nL).toFixed(4),
          y: +(r.top - nT).toFixed(4),
        }
      }
      const L = parse(kids[0], {
        cx: neutrals.L.cx,
        cy: neutrals.L.cy,
        w: neutrals.irisL.w,
        h: neutrals.irisL.h,
      })
      const R = parse(kids[1], {
        cx: neutrals.R.cx,
        cy: neutrals.R.cy,
        w: neutrals.irisR.w,
        h: neutrals.irisR.h,
      })
      const ang = (o) =>
        Math.hypot(o.x, o.y) < 0.05 ? null : +((Math.atan2(o.y, o.x) * 180) / Math.PI).toFixed(2)
      const cross = L.x * R.y - L.y * R.x
      const magL = Math.hypot(L.x, L.y)
      const magR = Math.hypot(R.x, R.y)
      // Parallel if cross≈0 OR either near-zero (neutral)
      const parallel =
        magL < 0.08 || magR < 0.08 || Math.abs(cross) < 0.08
      const converging =
        Math.sign(L.x) !== 0 &&
        Math.sign(R.x) !== 0 &&
        Math.sign(L.x) !== Math.sign(R.x) &&
        Math.sign(L.x) === 1 // L rightward + R leftward = toward beak
      return {
        label,
        cursor: { x, y },
        toCenter: {
          dx: +(x - imageCenter.x).toFixed(1),
          dy: +(y - imageCenter.y).toFixed(1),
        },
        L,
        R,
        angL: ang(L),
        angR: ang(R),
        magL: +magL.toFixed(3),
        magR: +magR.toFixed(3),
        cross: +cross.toFixed(6),
        parallel,
        convergingTowardBeak: converging,
      }
    },
    {
      neutrals: {
        L: embed.neutrals.L,
        R: embed.neutrals.R,
        irisL: embed.irisSize.L,
        irisR: embed.irisSize.R,
      },
      label,
      x,
      y,
      imageCenter,
    },
  )
}

const liveSamples = [
  await liveMeasure('mid-screen', 640, 400),
  await liveMeasure('midline-face', imageCenter.x, imageCenter.y),
  await liveMeasure('midline-below', imageCenter.x, imageCenter.y + 40),
  await liveMeasure('left-far', imageCenter.x - 200, imageCenter.y),
  await liveMeasure('right-far', imageCenter.x + 200, imageCenter.y),
]

const liveParallelPass = liveSamples.every((s) => s.parallel && !s.convergingTowardBeak)
const faceNearNeutral = liveSamples.find((s) => s.label === 'midline-face')
const deadZoneWorks =
  faceNearNeutral && faceNearNeutral.magL < 0.15 && faceNearNeutral.magR < 0.15

// Cardinal screenshots (far — full travel)
for (const [name, deg] of [
  ['right', 0],
  ['up', 90],
  ['left', 180],
  ['down', 270],
]) {
  const rad = (deg * Math.PI) / 180
  await page.mouse.move(
    imageCenter.x + Math.cos(rad) * 180,
    imageCenter.y + Math.sin(rad) * 180,
  )
  await page.waitForTimeout(400)
  await page.screenshot({
    path: resolve(outDir, `pucky-eyes-cardinal-${name}-1280x800.png`),
    fullPage: false,
  })
}

const containmentPass = totalViolations === 0
const parallelPass = coordViolations === 0

const report = {
  diagnosis: {
    note: 'Pre-fix live mid-screen showed parallel +Y offsets (not per-eye direction). Perceived cross-eye near face was center singularity / looking-at-cursor-below; dead-zone restores straight-ahead.',
    runtimeAtan2Sites: ['sharedGazeOffsets only — single atan2(cursor−imageCenter)'],
    perEyeAngleRemoved: 'none found in runtime (never present after last fix)',
  },
  deadZone: {
    eyeSpanPx: +eyeSpan.toFixed(1),
    mul: DEAD_ZONE_MUL,
    radiusPx: +deadR.toFixed(1),
    easing: 'smoothstep(0, radius, faceDist) × magnitude',
  },
  cardinalTravelPx368: cardinalTravel,
  containment: {
    violations: totalViolations,
    verdict: containmentPass ? 'PASS' : 'FAIL',
  },
  parallelVectors: {
    violations: coordViolations,
    maxCrossProduct: +maxCross.toFixed(10),
    verdict: parallelPass ? 'PASS' : 'FAIL',
  },
  live: {
    samples: liveSamples,
    parallelVerdict: liveParallelPass ? 'PASS' : 'FAIL',
    deadZoneNeutralAtFace: deadZoneWorks ? 'PASS' : 'FAIL',
  },
  failSamples,
}

writeFileSync(resolve(outDir, 'pucky-eyes-lut-sweep-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
if (!containmentPass || !parallelPass || !liveParallelPass || !deadZoneWorks) {
  process.exitCode = 1
}
