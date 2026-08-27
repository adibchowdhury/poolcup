/**
 * Verify card-first Pucky composition: form contained, head above, no feet below.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

async function probe(viewport) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport })
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(400)

  const metrics = await page.evaluate(() => {
    const stage = document.querySelector('.login-pucky-stage')
    const frame = document.querySelector('.login-pucky-frame')
    const card = document.querySelector('.login-pucky-card')
    if (!stage || !frame || !card) return { ok: false }

    const sc = getComputedStyle(stage)
    const scale = parseFloat(sc.getPropertyValue('--pucky-scale'))
    const offsetY = parseFloat(sc.getPropertyValue('--pucky-offset-y'))
    const sr = stage.getBoundingClientRect()
    const fr = frame.getBoundingClientRect()
    const cr = card.getBoundingClientRect()

    // Content containment: every interactive control's box inside card
    const selectors = [
      '#email',
      '#password',
      'button[type="submit"]',
      'a[href^="/create-account"]',
      'button:has-text("Forgot password?")',
      'button:has-text("Continue with Google")',
      '.login-pucky-card p',
    ]
    const containment = []
    for (const sel of [
      '#email',
      '#password',
      'button[type="submit"]',
      'a[href^="/create-account"]',
    ]) {
      const el = document.querySelector(sel)
      if (!el) {
        containment.push({ sel, ok: false, reason: 'missing' })
        continue
      }
      const r = el.getBoundingClientRect()
      const ok =
        r.top >= cr.top - 1 &&
        r.bottom <= cr.bottom + 1 &&
        r.left >= cr.left - 1 &&
        r.right <= cr.right + 1
      containment.push({
        sel,
        ok,
        spill: ok ? 0 : +(Math.max(0, r.bottom - cr.bottom) + Math.max(0, cr.top - r.top)).toFixed(1),
      })
    }

    // Hand approx: opening left/right at 0.2288 / 0.7696 of frame
    const handL = fr.left + fr.width * 0.2288
    const handR = fr.left + fr.width * 0.7696

    return {
      ok: true,
      scale,
      offsetY,
      frameDisplay: getComputedStyle(frame).display,
      framePE: getComputedStyle(frame).pointerEvents,
      cardOverflow: getComputedStyle(card).overflow,
      stage: { w: +sr.width.toFixed(1), h: +sr.height.toFixed(1), top: +sr.top.toFixed(1), bottom: +sr.bottom.toFixed(1) },
      frame: { w: +fr.width.toFixed(1), h: +fr.height.toFixed(1), top: +fr.top.toFixed(1), bottom: +fr.bottom.toFixed(1) },
      card: { w: +cr.width.toFixed(1), h: +cr.height.toFixed(1), top: +cr.top.toFixed(1), bottom: +cr.bottom.toFixed(1), aspect: +(cr.width / cr.height).toFixed(3) },
      headAbove: fr.top < cr.top - 20,
      headPeekPx: +(cr.top - fr.top).toFixed(1),
      feetBelow: fr.bottom > cr.bottom + 2,
      feetCovered: fr.bottom <= cr.bottom + 2,
      scaleVsCard: +(fr.width / cr.width).toFixed(3),
      hands: {
        leftGap: +(handL - cr.left).toFixed(1),
        rightGap: +(cr.right - handR).toFixed(1),
      },
      containment,
      allContained: containment.every((c) => c.ok),
      breathing: {
        top: +sr.top.toFixed(1),
        // include head peek in composition top
        compTop: +fr.top.toFixed(1),
        compBottom: +Math.max(fr.bottom, cr.bottom).toFixed(1),
        bottom: +(window.innerHeight - Math.max(fr.bottom, cr.bottom)).toFixed(1),
      },
    }
  })

  const label = `${viewport.width}x${viewport.height}`
  const shot = resolve(outDir, `login-pucky-card-first-${label}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  await browser.close()
  return { viewport: label, metrics, shot }
}

const results = []
for (const vp of [{ width: 1280, height: 800 }]) {
  results.push(await probe(vp))
}

writeFileSync(resolve(outDir, 'login-pucky-card-first-report.json'), JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))

const m = results[0].metrics
const pass =
  m.ok &&
  m.frameDisplay === 'block' &&
  m.framePE === 'none' &&
  m.allContained &&
  m.headAbove &&
  m.feetCovered &&
  m.scaleVsCard >= 1.15 &&
  m.scaleVsCard <= 1.35 &&
  m.breathing.compTop >= -2 &&
  m.breathing.bottom >= 20

console.log(pass ? 'PASS' : 'FAIL')
process.exit(pass ? 0 : 1)
