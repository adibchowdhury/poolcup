/**
 * Stadium atmosphere tone-down — capture 1280 / 1440 / 1920 + layer metrics.
 * Usage: node scripts/screenshot-login-stadium-tone.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const viewports = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
]

const browser = await chromium.launch({ headless: true })

for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  })

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1000)

  const metrics = await page.evaluate(() => {
    const main = document.querySelector('main.login-page-shell')
    if (!main) return { error: 'no main' }
    const cs = getComputedStyle(main)
    const before = getComputedStyle(main, '::before')
    const after = getComputedStyle(main, '::after')
    const card = main.querySelector(':scope > div')
    const cardBox = card?.getBoundingClientRect()
    const mainBox = main.getBoundingClientRect()
    const cardCenterYPct = cardBox
      ? Math.round(((cardBox.top + cardBox.height / 2) / mainBox.height) * 1000) / 10
      : null
    return {
      vars: {
        brightness: cs.getPropertyValue('--login-bg-brightness').trim(),
        saturate: cs.getPropertyValue('--login-bg-saturate').trim(),
        blur: cs.getPropertyValue('--login-bg-blur').trim(),
        overlay: cs.getPropertyValue('--login-bg-overlay').trim(),
        focusY: cs.getPropertyValue('--login-bg-focus-y').trim(),
      },
      beforeFilter: before.filter,
      beforeBg: before.backgroundImage.slice(0, 60),
      afterBgLayers: after.backgroundImage.split('),').length,
      card: cardBox
        ? {
            w: Math.round(cardBox.width),
            h: Math.round(cardBox.height),
            top: Math.round(cardBox.top),
            left: Math.round(cardBox.left),
            centerYPct: cardCenterYPct,
          }
        : null,
      focusYVar: cs.getPropertyValue('--login-bg-focus-y').trim(),
    }
  })

  const shot = resolve(outDir, `login-bg-stadium-after-${vp.name}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  console.log(`\n=== ${vp.name} ===`)
  console.log(`shot: ${shot}`)
  console.log(JSON.stringify(metrics, null, 2))
  await page.close()
}

await browser.close()
console.log('\nDone')
