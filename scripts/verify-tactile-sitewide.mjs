/**
 * Site-wide tactile depth sweep — major surfaces @ 1280×800.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const pages = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'create', path: '/create' },
  { name: 'settings', path: '/settings' },
]

const browser = await chromium.launch({ headless: true })
const report = []

for (const entry of pages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const url = `${baseUrl}${entry.path}`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForTimeout(900)
  } catch (e) {
    report.push({ name: entry.name, error: String(e) })
    await page.close()
    continue
  }

  const metrics = await page.evaluate(() => {
    const tactile = [...document.querySelectorAll('.ui-tactile-btn')].slice(0, 12)
    return {
      href: location.pathname,
      title: document.title,
      tactileCount: document.querySelectorAll('.ui-tactile-btn').length,
      dropLeftover: document.querySelectorAll('.ui-tactile-btn--drop').length,
      samples: tactile.map((el) => {
        const cs = getComputedStyle(el)
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 36),
          shadow: cs.boxShadow.slice(0, 80),
          transform: cs.transform,
          surface: cs.getPropertyValue('--tactile-btn-surface').trim().slice(0, 40),
          edge: cs.getPropertyValue('--tactile-btn-edge').trim().slice(0, 80),
          disabled: el instanceof HTMLButtonElement ? el.disabled : false,
          flat: el.classList.contains('ui-tactile-btn--flat'),
        }
      }),
    }
  })

  const shot = resolve(outDir, `tactile-sweep-${entry.name}-1280x800.png`)
  await page.screenshot({ path: shot, fullPage: false })
  report.push({ name: entry.name, metrics, shot })
  await page.close()
}

// Dialog sample — open report-issue if available from login/settings, else skip
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(500)
const dialogShot = resolve(outDir, 'tactile-sweep-dialog-1280x800.png')
// Capture login as dialog stand-in if no dialog trigger; try create-account link area
await page.screenshot({ path: dialogShot, fullPage: false })
report.push({ name: 'dialog-proxy-login', shot: dialogShot, note: 'login CTAs stand in; AlertDialog uses Button variants' })
await page.close()

writeFileSync(resolve(outDir, 'tactile-sweep-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
