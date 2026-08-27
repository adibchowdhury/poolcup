/**
 * Travel-range QA @ 1280×800: outer saturation + inner restraint.
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
const EYES = [
  {
    iris: { cx: 0.4215, w: 0.0529 },
    eye: { cx: 0.392, w: 0.13 },
  },
  {
    iris: { cx: 0.5687, w: 0.0554 },
    eye: { cx: 0.596, w: 0.131 },
  },
]
const outerMarginF = 0.055
const innerPadF = 0.06
const clampIrisInset = 1.05
const clampScale = 0.78

function radii(i) {
  const e = EYES[i]
  const eyeW = e.eye.w * W
  const irisW = e.iris.w * W
  const eyeCx = e.eye.cx * W
  const irisCx = e.iris.cx * W
  const baseRx = (eyeW / 2 - (irisW / 2) * clampIrisInset) * clampScale
  const rxInner = baseRx - eyeW * innerPadF
  const outerMargin = eyeW * outerMarginF
  const outerSpace =
    i === 0
      ? irisCx - irisW / 2 - (eyeCx - eyeW / 2)
      : eyeCx + eyeW / 2 - (irisCx + irisW / 2)
  const rxOuter = outerSpace - outerMargin
  return {
    rxOuter: +rxOuter.toFixed(2),
    rxInner: +rxInner.toFixed(2),
    outerMargin: +outerMargin.toFixed(2),
    rxPos: i === 0 ? +rxInner.toFixed(2) : +rxOuter.toFixed(2),
    rxNeg: i === 0 ? +rxOuter.toFixed(2) : +rxInner.toFixed(2),
  }
}

const Lr = radii(0)
const Rr = radii(1)
const oldMaxR = 0.077 * Math.min(0.13 * W, 0.253 * H)
const newMaxR = Math.max(0.48 * Math.min(0.13 * W, 0.253 * H), Lr.rxOuter, Rr.rxOuter)

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

const gaze = {
  x: frame.left + GAZE_REF.cx * frame.width,
  y: frame.top + GAZE_REF.cy * frame.height,
}

async function read() {
  return page.evaluate(() => {
    const eyes = document.querySelector('.login-pucky-eyes')
    if (!eyes) return null
    return [...eyes.children].map((el) => ({
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0,
      w: el.getBoundingClientRect().width,
    }))
  })
}

await page.mouse.move(0, 0)
await page.evaluate(() =>
  document.documentElement.dispatchEvent(new Event('mouseleave', { bubbles: true })),
)
await page.waitForTimeout(600)
const neu = await read()

const delta = (c, n) => ({
  dx: +(c.left - n.left).toFixed(2),
  dy: +(c.top - n.top).toFixed(2),
})

// Far right — R should near rxOuter; L should near rxInner (+)
await page.mouse.move(1270, gaze.y)
await page.waitForTimeout(350)
const farRight = await read()
const dRight = { L: delta(farRight[0], neu[0]), R: delta(farRight[1], neu[1]) }

// Far left — L near -rxOuter; R near -rxInner
await page.mouse.move(8, gaze.y)
await page.waitForTimeout(350)
const farLeft = await read()
const dLeft = { L: delta(farLeft[0], neu[0]), R: delta(farLeft[1], neu[1]) }

// Inward check: cursor slightly right of gaze → L should NOT exceed rxInner
await page.mouse.move(gaze.x + 120, gaze.y)
await page.waitForTimeout(300)
const inwardR = await read()
const dInR = { L: delta(inwardR[0], neu[0]), R: delta(inwardR[1], neu[1]) }

await page.mouse.move(gaze.x - 120, gaze.y)
await page.waitForTimeout(300)
const inwardL = await read()
const dInL = { L: delta(inwardL[0], neu[0]), R: delta(inwardL[1], neu[1]) }

const tol = 0.6
const rightOk =
  Math.abs(dRight.R.dx - Rr.rxOuter) < tol &&
  Math.abs(dRight.L.dx - Lr.rxInner) < tol &&
  dRight.L.dx > 0 &&
  dRight.R.dx > 0
const leftOk =
  Math.abs(dLeft.L.dx + Lr.rxOuter) < tol &&
  Math.abs(dLeft.R.dx + Rr.rxInner) < tol &&
  dLeft.L.dx < 0 &&
  dLeft.R.dx < 0
const beakOk =
  dInR.L.dx <= Lr.rxInner + tol &&
  dInL.R.dx >= -(Rr.rxInner + tol)

// Live outer margin: iris edge vs eye outline at far right (R)
function liveMargin(side) {
  const eye = side === 'R' ? EYES[1] : EYES[0]
  const dx = side === 'R' ? dRight.R.dx : dLeft.L.dx
  const irisW = eye.iris.w * frame.width
  const eyeW = eye.eye.w * frame.width
  const irisCx = eye.iris.cx * frame.width + dx
  const eyeCx = eye.eye.cx * frame.width
  if (side === 'R') {
    return +(eyeCx + eyeW / 2 - (irisCx + irisW / 2)).toFixed(2)
  }
  return +(irisCx - irisW / 2 - (eyeCx - eyeW / 2)).toFixed(2)
}

await page.screenshot({
  path: resolve(outDir, 'pucky-eyes-travel-1280x800.png'),
  fullPage: false,
})

const report = {
  asymmetricRadii: {
    L: { rxOuter: Lr.rxOuter, rxInner: Lr.rxInner, rxNeg: Lr.rxNeg, rxPos: Lr.rxPos },
    R: { rxOuter: Rr.rxOuter, rxInner: Rr.rxInner, rxNeg: Rr.rxNeg, rxPos: Rr.rxPos },
  },
  outwardMarginPx: {
    target: Lr.outerMargin,
    liveAtFarLeft_L: liveMargin('L'),
    liveAtFarRight_R: liveMargin('R'),
  },
  saturation: {
    oldMaxRPx: +oldMaxR.toFixed(2),
    newMaxRPx: +newMaxR.toFixed(2),
    raised: true,
    reason:
      'Old maxRadius 3.68px capped shared gaze before rxOuter (~22px); raised to ≥ rxOuter so far-edge saturates outer ellipse',
    farRightReachedOuter: Math.abs(dRight.R.dx - Rr.rxOuter) < tol,
    farLeftReachedOuter: Math.abs(dLeft.L.dx + Lr.rxOuter) < tol,
  },
  sweeps: { dRight, dLeft, dInR, dInL, rightOk, leftOk, beakOk },
}

writeFileSync(resolve(outDir, 'pucky-eyes-travel-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
if (!rightOk || !leftOk || !beakOk) process.exitCode = 1
