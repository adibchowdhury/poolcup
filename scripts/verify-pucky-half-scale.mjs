/**
 * Pucky scale + composition offset checks @ 1280×800: hands, centering, eyes idle + sweep.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import sharp from 'sharp'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(900)

const metrics = await page.evaluate(() => {
  const stage = document.querySelector('.login-pucky-stage')
  const frame = document.querySelector('.login-pucky-frame')
  const panel = document.querySelector('.login-pucky-panel-form')
  const card = document.querySelector('.login-pucky-card')
  const eyes = document.querySelector('.login-pucky-eyes')
  if (!stage || !frame || !panel || !card) return { error: 'missing nodes' }

  const sc = getComputedStyle(stage)
  const puckyScale = sc.getPropertyValue('--pucky-scale').trim()
  const handY = sc.getPropertyValue('--pucky-hand-y').trim()
  const handOverlap = sc.getPropertyValue('--pucky-hand-overlap').trim()

  const sr = stage.getBoundingClientRect()
  const fr = frame.getBoundingClientRect()
  const pr = panel.getBoundingClientRect()
  const cr = card.getBoundingClientRect()

  const panelCenterX = pr.left + pr.width / 2
  const frameCenterX = fr.left + fr.width / 2
  const centerDelta = frameCenterX - panelCenterX

  // Hand contact line ≈ asset y=0.7578 from frame top (pre-transform layout)
  const handLineY = fr.top + fr.height * 0.7578
  const cardTopY = cr.top

  const assemblies = eyes
    ? [...eyes.children].map((el) => {
        const r = el.getBoundingClientRect()
        return { w: +r.width.toFixed(2), h: +r.height.toFixed(2) }
      })
    : []

  return {
    puckyScale,
    handY,
    handOverlap,
    stageTransform: sc.transform,
    frame: {
      w: +fr.width.toFixed(2),
      h: +fr.height.toFixed(2),
      top: +fr.top.toFixed(2),
    },
    panel: { centerX: +panelCenterX.toFixed(2) },
    frameCenterX: +frameCenterX.toFixed(2),
    centerDeltaPx: +centerDelta.toFixed(2),
    handLineY: +handLineY.toFixed(2),
    cardTopY: +cardTopY.toFixed(2),
    handToCardGapPx: +(handLineY - cardTopY).toFixed(2),
    assemblies,
    maxGazePxAtFrame: +(4 * (fr.width / 368)).toFixed(2),
  }
})

// Idle face compare (live DOM eyes vs reference at same frame size)
const idle = await page.evaluate(() => {
  const frame = document.querySelector('.login-pucky-frame')
  if (!frame) return null
  const fr = frame.getBoundingClientRect()
  return {
    x: Math.round(fr.left + fr.width * 0.32),
    y: Math.round(fr.top + fr.height * 0.32),
    w: Math.round(fr.width * 0.36),
    h: Math.round(fr.height * 0.3),
    frameW: fr.width,
    frameH: fr.height,
  }
})

const liveFace = resolve(outDir, 'pucky-idle-live-face-half.png')
await page.screenshot({
  path: liveFace,
  clip: { x: idle.x, y: idle.y, width: idle.w, height: idle.h },
})

const frameW = Math.round(idle.frameW)
const frameH = Math.round(idle.frameH)
const refFace = resolve(outDir, 'pucky-idle-ref-face-half.png')
await sharp('public/login_assets/pucky-login-frame.png')
  .resize(frameW, frameH, { fit: 'fill' })
  .extract({
    left: Math.round(frameW * 0.32),
    top: Math.round(frameH * 0.32),
    width: Math.round(frameW * 0.36),
    height: Math.round(frameH * 0.3),
  })
  .png()
  .toFile(refFace)

const liveBuf = await sharp(liveFace).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
const refBuf = await sharp(refFace).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
let sum = 0
let max = 0
const n = liveBuf.info.width * liveBuf.info.height
for (let i = 0; i < n; i++) {
  const o = i * 4
  const dr =
    Math.abs(liveBuf.data[o] - refBuf.data[o]) +
    Math.abs(liveBuf.data[o + 1] - refBuf.data[o + 1]) +
    Math.abs(liveBuf.data[o + 2] - refBuf.data[o + 2])
  sum += dr
  max = Math.max(max, dr)
}

// Sweep: cardinal directions + max travel
const frame = await page.evaluate(() => {
  const fr = document.querySelector('.login-pucky-frame')?.getBoundingClientRect()
  return fr ? { left: fr.left, top: fr.top, width: fr.width, height: fr.height } : null
})
const cx = frame.left + frame.width / 2
const cy = frame.top + frame.height / 2
const sweepPts = [
  { name: 'idle', x: cx, y: cy },
  { name: 'far-right', x: frame.left + frame.width + 120, y: cy },
  { name: 'far-left', x: frame.left - 120, y: cy },
  { name: 'far-up', x: cx, y: frame.top - 80 },
  { name: 'far-down', x: cx, y: frame.top + frame.height + 80 },
]

const sweep = []
for (const pt of sweepPts) {
  await page.mouse.move(pt.x, pt.y)
  await page.waitForTimeout(350)
  const offsets = await page.evaluate(() => {
    const eyes = document.querySelector('.login-pucky-eyes')
    if (!eyes) return null
    return [...eyes.children].map((el) => {
      const r = el.getBoundingClientRect()
      const fr = document.querySelector('.login-pucky-frame')?.getBoundingClientRect()
      if (!fr) return null
      const neutralCx = fr.left + 0.4161 * fr.width
      const neutralCy = fr.top + 0.4385 * fr.height
      return {
        dx: +(r.left + r.width / 2 - neutralCx).toFixed(2),
        dy: +(r.top + r.height / 2 - neutralCy).toFixed(2),
        mag: +Math.hypot(r.left + r.width / 2 - neutralCx, r.top + r.height / 2 - neutralCy).toFixed(2),
      }
    })
  })
  sweep.push({ point: pt.name, offsets })
}

await page.mouse.move(cx, cy)
await page.waitForTimeout(200)
const shot = resolve(outDir, 'login-pucky-grow-up-1280x800.png')
await page.screenshot({ path: shot, fullPage: false })

const report = {
  metrics,
  idle: {
    frameW,
    frameH,
    avgDr: +(sum / n).toFixed(2),
    maxDr: max,
    verdict: sum / n < 55 ? 'close-acceptable' : 'visible-mismatch',
  },
  sweep,
  maxSweepMag: Math.max(...sweep.flatMap((s) => s.offsets?.map((o) => o?.mag ?? 0) ?? [0])),
  screenshot: shot,
}

writeFileSync(resolve(outDir, 'pucky-grow-up-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
