/**
 * Pucky eye tracking QA:
 * 1) Idle reconstruction vs original PNG at same render size
 * 2) Layout freeze check (frame box)
 * 3) Sweep tracking at 1280x800 and 1440x900
 *
 * Usage: node scripts/qa-pucky-eyes.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import sharp from 'sharp'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })

async function measureFrame(page) {
  return page.evaluate(() => {
    const frame = document.querySelector('.login-pucky-frame')
    const eyes = document.querySelector('.login-pucky-eyes')
    const card = document.querySelector('.login-pucky-card')
    if (!frame) return { error: 'no frame' }
    const fr = frame.getBoundingClientRect()
    const cr = card?.getBoundingClientRect()
    const assemblies = eyes
      ? [...eyes.children].map((el) => {
          const r = el.getBoundingClientRect()
          return {
            w: +r.width.toFixed(2),
            h: +r.height.toFixed(2),
            left: +r.left.toFixed(2),
            top: +r.top.toFixed(2),
          }
        })
      : []
    return {
      src: frame.getAttribute('src'),
      frame: {
        w: +fr.width.toFixed(2),
        h: +fr.height.toFixed(2),
        left: +fr.left.toFixed(2),
        top: +fr.top.toFixed(2),
      },
      card: cr
        ? {
            w: +cr.width.toFixed(2),
            h: +cr.height.toFixed(2),
            left: +cr.left.toFixed(2),
            top: +cr.top.toFixed(2),
          }
        : null,
      assemblies,
      eyesPointerEvents: eyes ? getComputedStyle(eyes).pointerEvents : null,
    }
  })
}

async function clickThrough(page) {
  return page.evaluate(async () => {
    const email = document.querySelector('input[type="email"]')
    const link = document.querySelector('a')
    const results = {}
    if (email) {
      email.focus()
      results.emailFocused = document.activeElement === email
    }
    if (link) {
      const before = location.href
      // Don't navigate — just check hit-test
      const r = link.getBoundingClientRect()
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      results.linkHit = !!el && (el === link || link.contains(el))
    }
    results.forgotHit = (() => {
      const btn = [...document.querySelectorAll('button, a')].find((el) =>
        /forgot/i.test(el.textContent || ''),
      )
      if (!btn) return null
      const r = btn.getBoundingClientRect()
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return !!el && (el === btn || btn.contains(el))
    })()
    return results
  })
}

/** Composite eyeless + DOM eyes crop vs original at same size via page screenshots of face region. */
async function idleCompare(page) {
  const region = await page.evaluate(() => {
    const frame = document.querySelector('.login-pucky-frame')
    if (!frame) return null
    const fr = frame.getBoundingClientRect()
    // Face band ~ y 0.32–0.58 of frame, x 0.32–0.68
    return {
      x: Math.round(fr.left + fr.width * 0.32),
      y: Math.round(fr.top + fr.height * 0.32),
      w: Math.round(fr.width * 0.36),
      h: Math.round(fr.height * 0.3),
      frameW: fr.width,
      frameH: fr.height,
    }
  })
  if (!region) return { error: 'no region' }

  const livePath = resolve(outDir, 'pucky-idle-live-face.png')
  await page.screenshot({
    path: livePath,
    clip: { x: region.x, y: region.y, width: region.w, height: region.h },
  })

  // Build reference: render original PNG at same frame size, crop same fractions
  const frameW = Math.round(region.frameW)
  const frameH = Math.round(region.frameH)
  const refFull = resolve(outDir, 'pucky-idle-ref-scaled.png')
  await sharp('public/login_assets/pucky-login-frame.png')
    .resize(frameW, frameH, { fit: 'fill' })
    .png()
    .toFile(refFull)

  const refFace = resolve(outDir, 'pucky-idle-ref-face.png')
  await sharp(refFull)
    .extract({
      left: Math.round(frameW * 0.32),
      top: Math.round(frameH * 0.32),
      width: Math.round(frameW * 0.36),
      height: Math.round(frameH * 0.3),
    })
    .png()
    .toFile(refFace)

  // Pixel diff
  const live = await sharp(livePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const ref = await sharp(refFace).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const n = Math.min(live.data.length, ref.data.length) / 4
  let sum = 0
  let max = 0
  let over40 = 0
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const dr =
      Math.abs(live.data[o] - ref.data[o]) +
      Math.abs(live.data[o + 1] - ref.data[o + 1]) +
      Math.abs(live.data[o + 2] - ref.data[o + 2])
    sum += dr
    max = Math.max(max, dr)
    if (dr > 40) over40++
  }
  return {
    region,
    avgDr: +(sum / n).toFixed(2),
    maxDr: max,
    over40Rate: +(over40 / n).toFixed(4),
    livePath,
    refFace,
    verdict:
      sum / n < 25 && over40 / n < 0.12
        ? 'near-indistinguishable'
        : sum / n < 45 && over40 / n < 0.25
          ? 'close-acceptable'
          : 'visible-mismatch',
  }
}

async function sweep(page, name, vp) {
  const frame = await page.evaluate(() => {
    const fr = document.querySelector('.login-pucky-frame')?.getBoundingClientRect()
    return fr
      ? { left: fr.left, top: fr.top, width: fr.width, height: fr.height }
      : null
  })
  if (!frame) return { error: 'no frame' }

  const positions = [
    { label: 'tl', x: 8, y: 8 },
    { label: 'tr', x: vp.width - 10, y: 8 },
    { label: 'bl', x: 8, y: vp.height - 10 },
    { label: 'br', x: vp.width - 10, y: vp.height - 10 },
    { label: 'card', x: frame.left + frame.width / 2, y: frame.top + frame.height + 120 },
    { label: 'center', x: frame.left + frame.width / 2, y: frame.top + frame.height * 0.4 },
  ]

  const samples = []
  for (const p of positions) {
    await page.mouse.move(p.x, p.y)
    await page.waitForTimeout(180)
    const offs = await page.evaluate(() => {
      const eyes = document.querySelector('.login-pucky-eyes')
      if (!eyes) return null
      return [...eyes.children].map((el) => {
        const s = el.style
        // left/top include offset; recover via transform? we use left/top directly
        return {
          left: parseFloat(s.left) || 0,
          top: parseFloat(s.top) || 0,
          w: parseFloat(s.width) || 0,
          h: parseFloat(s.height) || 0,
        }
      })
    })
    samples.push({ ...p, offs })
  }

  // Leave viewport → return toward neutral
  await page.mouse.move(0, 0)
  await page.evaluate(() => {
    document.documentElement.dispatchEvent(new Event('mouseleave', { bubbles: true }))
  })
  await page.waitForTimeout(400)
  const afterLeave = await page.evaluate(() => {
    const eyes = document.querySelector('.login-pucky-eyes')
    if (!eyes) return null
    return [...eyes.children].map((el) => ({
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0,
    }))
  })

  const shot = resolve(outDir, `pucky-eyes-sweep-${name}.png`)
  await page.mouse.move(frame.left + frame.width * 0.85, frame.top + frame.height * 0.2)
  await page.waitForTimeout(200)
  await page.screenshot({ path: shot, fullPage: false })

  return { frame, samples, afterLeave, shot }
}

const report = { viewports: {} }

for (const vp of [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
]) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  })
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1000)

  const metrics = await measureFrame(page)
  const clicks = await clickThrough(page)
  const idle = vp.name === '1280x800' ? await idleCompare(page) : null
  const sweepResult = await sweep(page, vp.name, vp)

  // Neutral layout shot
  await page.mouse.move(0, 0)
  await page.evaluate(() =>
    document.documentElement.dispatchEvent(new Event('mouseleave', { bubbles: true })),
  )
  await page.waitForTimeout(500)
  const idleShot = resolve(outDir, `pucky-eyes-idle-${vp.name}.png`)
  await page.screenshot({ path: idleShot, fullPage: false })

  report.viewports[vp.name] = { metrics, clicks, idle, sweep: sweepResult, idleShot }
  console.log(`\n=== ${vp.name} ===`)
  console.log(JSON.stringify(report.viewports[vp.name], null, 2))
  await page.close()
}

writeFileSync(resolve(outDir, 'pucky-eyes-qa-report.json'), JSON.stringify(report, null, 2))
await browser.close()
console.log('\nWrote pucky-eyes-qa-report.json')
