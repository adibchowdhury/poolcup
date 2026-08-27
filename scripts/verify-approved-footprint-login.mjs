/**
 * Verify approved footprint tile on /login (loadable data-URI + locked gradient).
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)

const metrics = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('main.login-page-shell'))
  const bg = cs.backgroundImage
  return {
    hasSvgDataUri: /data:image\/svg\+xml;base64,/.test(bg),
    // Approved asset path marker (M50 7) base64-ish — check decoded via includes of known b64 fragment
    hasApprovedPathFragment: bg.includes('TTUwIDcg') || bg.includes('NTAgNy'),
    hasOldGeneratedPath: bg.includes('LTE3LjY') || bg.includes('-17.6'),
    hasLockedRadial: /radial-gradient\(circle at 50% 45%/i.test(bg),
    hasLockedLinear: /125deg/i.test(bg) && /rgb\(10,\s*31,\s*22\)|#0a1f16/i.test(bg),
    bgSize: cs.backgroundSize,
    bgRepeat: cs.backgroundRepeat,
  }
})

const shot = resolve(outDir, 'login-approved-footprint-1280x800.png')
await page.screenshot({ path: shot, fullPage: false })
await browser.close()

console.log(JSON.stringify(metrics, null, 2))
console.log('shot:', shot)

const pass =
  metrics.hasSvgDataUri &&
  metrics.hasApprovedPathFragment &&
  !metrics.hasOldGeneratedPath &&
  metrics.hasLockedRadial &&
  metrics.hasLockedLinear &&
  metrics.bgSize.startsWith('76px 116px')

console.log(pass ? 'PASS' : 'FAIL')
process.exit(pass ? 0 : 1)
