/**
 * Login mobile pass: before/after probes + screenshots at 390, 430, desktop 1280.
 * Usage: node scripts/screenshot-login-mobile-pass.mjs [label]
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const label = process.argv[2] ?? 'probe'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

async function probe(page, viewport) {
  await page.setViewportSize(viewport)
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(500)

  const data = await page.evaluate(() => {
    const shell = document.querySelector('.login-page-shell')
    const stage = document.querySelector('.login-pucky-stage')
    const card = document.querySelector('.login-pucky-card')
    const form = document.querySelector('.login-pucky-panel-form')
    const aside = document.querySelector('.login-pucky-panel-aside')
    const frames = [...document.querySelectorAll('.login-pucky-frame')].map((el) => {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        src: el.getAttribute('src'),
        display: cs.display,
        width: Math.round(r.width),
        height: Math.round(r.height),
        top: Math.round(r.top),
        left: Math.round(r.left),
        visible: cs.display !== 'none' && r.width > 0 && r.height > 0,
      }
    })
    const logoWrap = document.querySelector('.login-mobile-logo')
    const logoLink = logoWrap?.querySelector('a')
    const logoImg = logoWrap?.querySelector('img')
    const h1 = form?.querySelector('h1')
    const email = document.querySelector('#email')
    const sr = stage?.getBoundingClientRect()
    const cr = card?.getBoundingClientRect()
    const fr = form?.getBoundingClientRect()
    const as = aside ? getComputedStyle(aside) : null
    const sc = stage ? getComputedStyle(stage) : null
    const shellPad = shell ? getComputedStyle(shell) : null
    const logoCs = logoWrap ? getComputedStyle(logoWrap) : null

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      shellPadding: shellPad
        ? {
            left: shellPad.paddingLeft,
            right: shellPad.paddingRight,
            top: shellPad.paddingTop,
            bottom: shellPad.paddingBottom,
          }
        : null,
      stage: sr
        ? {
            w: Math.round(sr.width),
            h: Math.round(sr.height),
            scale: sc?.transform,
            puckyScale: sc?.getPropertyValue('--pucky-scale')?.trim(),
            handY: sc?.getPropertyValue('--pucky-hand-y')?.trim(),
            handOverlap: sc?.getPropertyValue('--pucky-hand-overlap')?.trim(),
          }
        : null,
      card: cr
        ? {
            w: Math.round(cr.width),
            h: Math.round(cr.height),
            left: Math.round(cr.left),
            right: Math.round(window.innerWidth - cr.right),
            widthPct: Math.round((cr.width / window.innerWidth) * 1000) / 10,
          }
        : null,
      formPad: form
        ? {
            padding: getComputedStyle(form).padding,
            pt: getComputedStyle(form).paddingTop,
            px: getComputedStyle(form).paddingLeft,
          }
        : null,
      h1Size: h1 ? getComputedStyle(h1).fontSize : null,
      asideDisplay: as?.display ?? null,
      frames,
      logo: logoWrap
        ? {
            present: true,
            href: logoLink?.getAttribute('href') ?? null,
            display: logoCs?.display,
            w: logoImg ? Math.round(logoImg.getBoundingClientRect().width) : 0,
            h: logoImg ? Math.round(logoImg.getBoundingClientRect().height) : 0,
          }
        : { present: false },
      formTop: fr ? Math.round(fr.top) : null,
      emailScrollMargin: email ? getComputedStyle(email).scrollMarginTop : null,
    }
  })

  const shot = resolve(
    outDir,
    `login-mobile-${label}-${viewport.width}x${viewport.height}.png`,
  )
  await page.screenshot({ path: shot, fullPage: false })
  return { ...data, shot }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const results = {}
  for (const vp of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 1280, height: 800 },
  ]) {
    results[`${vp.width}x${vp.height}`] = await probe(page, vp)
  }

  // Keyboard smoke: shrink visual viewport, focus email, ensure field stays in view.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(300)
  const keyboard = await page.evaluate(async () => {
    const email = document.querySelector('#email')
    if (!(email instanceof HTMLElement)) return { ok: false, reason: 'no email' }
    email.focus()
    // Simulate keyboard: reduce layout viewport height (common mobile pattern).
    const beforeTop = email.getBoundingClientRect().top
    window.scrollBy(0, Math.max(0, beforeTop - 120))
    email.scrollIntoView({ block: 'center', behavior: 'instant' })
    const after = email.getBoundingClientRect()
    const vv = window.visualViewport
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight
    const inView = after.top >= 0 && after.bottom <= visibleBottom
    return {
      ok: inView,
      emailTop: Math.round(after.top),
      emailBottom: Math.round(after.bottom),
      visibleBottom: Math.round(visibleBottom),
      shellOverflowY: getComputedStyle(document.querySelector('.login-page-shell')).overflowY,
    }
  })
  results.keyboardSmoke390 = keyboard

  await browser.close()
  const reportPath = resolve(outDir, `login-mobile-${label}-report.json`)
  writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  console.log('Wrote', reportPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
