/**
 * Screenshot exact-spec login gradient + report card vs glow center.
 * Usage: node scripts/screenshot-login-exact-gradient.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const viewports = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
]

const browser = await chromium.launch({ headless: true })

for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  })
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  const metrics = await page.evaluate(() => {
    const main = document.querySelector('main.login-page-shell')
    const card = main?.querySelector(':scope > div')
    if (!main || !card) return { error: 'missing main/card' }
    const cs = getComputedStyle(main)
    const mainBox = main.getBoundingClientRect()
    const cardBox = card.getBoundingClientRect()
    const glowX = mainBox.width * 0.5
    const glowY = mainBox.height * 0.45
    const cardCx = cardBox.left + cardBox.width / 2 - mainBox.left
    const cardCy = cardBox.top + cardBox.height / 2 - mainBox.top
    return {
      bg: cs.backgroundImage.slice(0, 180),
      hasFootprintDataUri: /data:image\/svg\+xml/i.test(cs.backgroundImage),
      hasRadial: /radial-gradient/i.test(cs.backgroundImage),
      hasLinear125: /125deg|#07130f/i.test(cs.backgroundImage),
      glowPct: { x: 50, y: 45 },
      glowPx: { x: Math.round(glowX), y: Math.round(glowY) },
      cardCenterPx: { x: Math.round(cardCx), y: Math.round(cardCy) },
      deltaPx: {
        x: Math.round(cardCx - glowX),
        y: Math.round(cardCy - glowY),
      },
      cardSize: {
        w: Math.round(cardBox.width),
        h: Math.round(cardBox.height),
      },
    }
  })

  const shot = resolve(outDir, `login-exact-gradient-${vp.name}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  console.log(`\n=== ${vp.name} ===`)
  console.log(JSON.stringify(metrics, null, 2))
  console.log(`shot: ${shot}`)
  await page.close()
}

await browser.close()
console.log('\nDone')
