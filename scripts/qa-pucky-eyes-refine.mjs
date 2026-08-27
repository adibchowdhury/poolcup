/**
 * Eye-behavior refinement QA at 1280×800:
 * shared gaze midline pass + corner containment.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const W = 368
const H = 368 * (1024 / 1536)
const GAZE_REF = { cx: 0.4951, cy: 0.43875 }
const NEW = { L: { w: 0.0529, h: 0.0877 }, R: { w: 0.0554, h: 0.0867 } }
const OLD = { L: { w: 0.0605, h: 0.1002 }, R: { w: 0.0633, h: 0.0991 } }
const maxRadiusFactor = 0.077
const oldMaxRadiusFactor = 0.11
const innerEdgePadFactor = 0.06
const eyeMin = Math.min(0.13 * W, 0.253 * H)
const oldMaxR = oldMaxRadiusFactor * eyeMin
const newMaxR = maxRadiusFactor * eyeMin
const innerPad = 0.13 * W * innerEdgePadFactor

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1000)

const frame = await page.evaluate(() => {
  const fr = document.querySelector('.login-pucky-frame')?.getBoundingClientRect()
  return fr
    ? { left: fr.left, top: fr.top, width: fr.width, height: fr.height }
    : null
})
if (!frame) throw new Error('no frame')

const gazePage = {
  x: frame.left + GAZE_REF.cx * frame.width,
  y: frame.top + GAZE_REF.cy * frame.height,
}

async function readOffsets() {
  return page.evaluate(() => {
    const eyes = document.querySelector('.login-pucky-eyes')
    if (!eyes) return null
    return [...eyes.children].map((el) => ({
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0,
    }))
  })
}

await page.mouse.move(0, 0)
await page.evaluate(() =>
  document.documentElement.dispatchEvent(new Event('mouseleave', { bubbles: true })),
)
await page.waitForTimeout(500)
const neutral = await readOffsets()

const delta = (cur, neu) => ({
  dx: +(cur.left - neu.left).toFixed(3),
  dy: +(cur.top - neu.top).toFixed(3),
})

const samples = []
for (const d of [-80, -40, -20, -10, 0, 10, 20, 40, 80]) {
  await page.mouse.move(gazePage.x + d, gazePage.y)
  await page.waitForTimeout(160)
  const offs = await readOffsets()
  const dL = delta(offs[0], neutral[0])
  const dR = delta(offs[1], neutral[1])
  samples.push({
    label: `midline Δx=${d}`,
    dL,
    dR,
    sameSignX:
      Math.sign(dL.dx) === Math.sign(dR.dx) ||
      (Math.abs(dL.dx) < 0.2 && Math.abs(dR.dx) < 0.2),
    absDxDiff: +Math.abs(dL.dx - dR.dx).toFixed(3),
  })
}

const extremes = []
for (const c of [
  { label: 'tl', x: 8, y: 8 },
  { label: 'tr', x: 1270, y: 8 },
  { label: 'bl', x: 8, y: 790 },
  { label: 'br', x: 1270, y: 790 },
]) {
  await page.mouse.move(c.x, c.y)
  await page.waitForTimeout(220)
  const offs = await readOffsets()
  const dL = delta(offs[0], neutral[0])
  const dR = delta(offs[1], neutral[1])
  extremes.push({
    ...c,
    dL,
    dR,
    magL: +Math.hypot(dL.dx, dL.dy).toFixed(3),
    magR: +Math.hypot(dR.dx, dR.dy).toFixed(3),
    withinMaxR:
      Math.hypot(dL.dx, dL.dy) <= newMaxR + 0.35 &&
      Math.hypot(dR.dx, dR.dy) <= newMaxR + 0.35,
  })
}

const midlineOk = samples.every((s) => s.sameSignX && s.absDxDiff < 0.6)
const containOk = extremes.every((e) => e.withinMaxR)
const report = {
  irisSize: {
    old: {
      L: { w: +(OLD.L.w * W).toFixed(2), h: +(OLD.L.h * H).toFixed(2) },
      R: { w: +(OLD.R.w * W).toFixed(2), h: +(OLD.R.h * H).toFixed(2) },
    },
    new: {
      L: { w: +(NEW.L.w * W).toFixed(2), h: +(NEW.L.h * H).toFixed(2) },
      R: { w: +(NEW.R.w * W).toFixed(2), h: +(NEW.R.h * H).toFixed(2) },
    },
    shrink: '−12.5%',
  },
  maxTravel: {
    oldMaxRPx: +oldMaxR.toFixed(2),
    newMaxRPx: +newMaxR.toFixed(2),
    reduction: '−30%',
  },
  gazeRef: { ...GAZE_REF, note: 'midpoint of L/R iris neutral centers' },
  innerEdgePadPx: +innerPad.toFixed(2),
  midlineOk,
  containOk,
  samples,
  extremes,
}

writeFileSync(resolve(outDir, 'pucky-eyes-refine-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ midlineOk, containOk, irisSize: report.irisSize, maxTravel: report.maxTravel, gazeRef: report.gazeRef, innerEdgePadPx: report.innerEdgePadPx }, null, 2))
await browser.close()
if (!midlineOk || !containOk) process.exitCode = 1
