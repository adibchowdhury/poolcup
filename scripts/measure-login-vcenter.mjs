/**
 * Measure vertical gaps: viewport top → Pucky head top, card bottom → viewport bottom.
 * Combined unit is centered when those gaps match.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const label = process.argv[2] ?? 'probe'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

async function measure(page, viewport) {
  await page.setViewportSize(viewport)
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(500)

  const data = await page.evaluate(() => {
    const stage = document.querySelector('.login-pucky-stage')
    const card = document.querySelector('.login-pucky-card')
    const frames = [...document.querySelectorAll('.login-pucky-frame')]
    const frame = frames.find((el) => getComputedStyle(el).display !== 'none') ?? null
    if (!stage || !card || !frame) return { ok: false }

    const vh = window.innerHeight
    const fr = frame.getBoundingClientRect()
    const cr = card.getBoundingClientRect()
    const sr = stage.getBoundingClientRect()
    const sc = getComputedStyle(stage)

    const unitTop = Math.min(fr.top, cr.top)
    const unitBottom = Math.max(fr.bottom, cr.bottom)
    const gapAbove = unitTop
    const gapBelow = vh - unitBottom
    const overhang = cr.top - fr.top

    return {
      ok: true,
      vh,
      frame: { top: +fr.top.toFixed(1), bottom: +fr.bottom.toFixed(1), h: +fr.height.toFixed(1) },
      card: { top: +cr.top.toFixed(1), bottom: +cr.bottom.toFixed(1), h: +cr.height.toFixed(1) },
      stage: {
        top: +sr.top.toFixed(1),
        bottom: +sr.bottom.toFixed(1),
        h: +sr.height.toFixed(1),
        transform: sc.transform,
        padTop: sc.paddingTop,
        handY: sc.getPropertyValue('--pucky-hand-y').trim(),
        handOverlap: sc.getPropertyValue('--pucky-hand-overlap').trim(),
        scale: sc.getPropertyValue('--pucky-scale').trim(),
      },
      unit: { top: +unitTop.toFixed(1), bottom: +unitBottom.toFixed(1), h: +(unitBottom - unitTop).toFixed(1) },
      gapAbove: +gapAbove.toFixed(1),
      gapBelow: +gapBelow.toFixed(1),
      gapDelta: +(gapAbove - gapBelow).toFixed(1),
      freeSpace: +(gapAbove + gapBelow).toFixed(1),
      aboveSharePct: gapAbove + gapBelow > 0 ? +((100 * gapAbove) / (gapAbove + gapBelow)).toFixed(1) : null,
      belowSharePct: gapAbove + gapBelow > 0 ? +((100 * gapBelow) / (gapAbove + gapBelow)).toFixed(1) : null,
      overhangPx: +overhang.toFixed(1),
      derivedOverhang: +(
        parseFloat(sc.getPropertyValue('--pucky-hand-y')) * fr.height -
        parseFloat(sc.getPropertyValue('--pucky-hand-overlap'))
      ).toFixed(1),
      clippedTop: unitTop < -0.5,
      clippedBottom: unitBottom > vh + 0.5,
      shellPad: (() => {
        const s = getComputedStyle(document.querySelector('.login-page-shell'))
        return { top: s.paddingTop, bottom: s.paddingBottom, overflowY: s.overflowY }
      })(),
    }
  })

  const shot = resolve(outDir, `login-vcenter-${label}-${viewport.width}x${viewport.height}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  return { ...data, shot }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const results = {}
  for (const vp of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
    { width: 390, height: 668 },
    { width: 1280, height: 668 },
  ]) {
    results[`${vp.width}x${vp.height}`] = await measure(page, vp)
  }
  await browser.close()
  const path = resolve(outDir, `login-vcenter-${label}-report.json`)
  writeFileSync(path, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
