/**
 * Screenshot login background cover behavior at 1280 / 768 / 390.
 * Usage: node scripts/screenshot-login-background.mjs
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
  const warnings = []
  page.on('console', (msg) => {
    if (/error|warn/i.test(msg.type())) warnings.push(msg.text())
  })

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(800)

  const metrics = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return { error: 'no main' }
    const cs = getComputedStyle(main)
    const card = main.querySelector(':scope > div')
    const cardBox = card?.getBoundingClientRect()
    const mainBox = main.getBoundingClientRect()
    return {
      mainH: Math.round(mainBox.height),
      viewportH: window.innerHeight,
      fillsViewport: Math.abs(mainBox.height - window.innerHeight) < 2 || mainBox.height >= window.innerHeight,
      bgImage: cs.backgroundImage.slice(0, 80),
      bgSize: cs.backgroundSize,
      bgPosition: cs.backgroundPosition,
      bgRepeat: cs.backgroundRepeat,
      card: cardBox
        ? {
            w: Math.round(cardBox.width),
            h: Math.round(cardBox.height),
            top: Math.round(cardBox.top),
            left: Math.round(cardBox.left),
          }
        : null,
    }
  })

  const shot = resolve(outDir, `login-bg-${vp.name}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  console.log(`\n=== ${vp.name} ===`)
  console.log(`shot: ${shot}`)
  console.log(JSON.stringify(metrics, null, 2))
  if (warnings.length) console.log('console:', warnings.slice(0, 5))
  await page.close()
}

await browser.close()
console.log('\nDone')
