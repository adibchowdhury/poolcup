/**
 * Containment-correct outward travel QA @ 1280×800.
 * Screenshots at far-left and far-right max gaze.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const W = 368
const GAZE_REF = { cx: 0.4951, cy: 0.43875 }
const L = { irisW: 0.0529 * W, outerExt: (66 / 1536) * W }
const R = { irisW: 0.0554 * W, outerExt: (68 / 1536) * W }
const safety = (3 / 368) * W
const rxOuterL = L.outerExt - L.irisW / 2 - safety
const rxOuterR = R.outerExt - R.irisW / 2 - safety
const rxInnerL = 7.82
const rxInnerR = 7.56

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

await page.mouse.move(8, gaze.y)
await page.waitForTimeout(400)
const farLeft = await read()
const dLeft = { L: delta(farLeft[0], neu[0]), R: delta(farLeft[1], neu[1]) }
await page.screenshot({
  path: resolve(outDir, 'pucky-eyes-max-left-1280x800.png'),
  fullPage: false,
})

await page.mouse.move(1270, gaze.y)
await page.waitForTimeout(400)
const farRight = await read()
const dRight = { L: delta(farRight[0], neu[0]), R: delta(farRight[1], neu[1]) }
await page.screenshot({
  path: resolve(outDir, 'pucky-eyes-max-right-1280x800.png'),
  fullPage: false,
})

const gapL = L.outerExt - L.irisW / 2 - Math.abs(dLeft.L.dx)
const gapR = R.outerExt - R.irisW / 2 - Math.abs(dRight.R.dx)

const tol = 0.55
const leftOk =
  Math.abs(Math.abs(dLeft.L.dx) - rxOuterL) < tol && dLeft.L.dx < 0 && gapL > 2
const rightOk =
  Math.abs(Math.abs(dRight.R.dx) - rxOuterR) < tol && dRight.R.dx > 0 && gapR > 2
const beakOk =
  dRight.L.dx <= rxInnerL + tol && dLeft.R.dx >= -(rxInnerR + tol)

const report = {
  mechanism:
    'Confirmed: prior ~22px CENTER travel used an inflated investigation eye ellipse as socketR in (socketR−irisR−margin), so the iris disc crossed the true outline. Corrected with measured iris-center→outline chord.',
  formula: 'rxOuter = outerHalfExtent − irisRadius − safetyMargin (~3px at 368-wide frame)',
  safetyMarginPx: +safety.toFixed(2),
  final: {
    rxOuterL: +rxOuterL.toFixed(2),
    rxOuterR: +rxOuterR.toFixed(2),
    rxInnerL,
    rxInnerR,
    gapAtMaxL: +gapL.toFixed(2),
    gapAtMaxR: +gapR.toFixed(2),
    liveDx: { left_L: dLeft.L.dx, right_R: dRight.R.dx },
  },
  sweeps: { dLeft, dRight, leftOk, rightOk, beakOk },
  shots: [
    'scripts/.screenshots/pucky-eyes-max-left-1280x800.png',
    'scripts/.screenshots/pucky-eyes-max-right-1280x800.png',
  ],
}

writeFileSync(resolve(outDir, 'pucky-eyes-containment-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
if (!leftOk || !rightOk || !beakOk) process.exitCode = 1
