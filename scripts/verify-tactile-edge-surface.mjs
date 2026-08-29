import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

const out = resolve('scripts/.screenshots')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)

await page.evaluate(() => {
  const wrap = document.createElement('div')
  wrap.id = 'tactile-audit'
  wrap.style.cssText =
    'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:#0d0d0d'
  wrap.innerHTML = `
    <button type="button" class="ui-tactile-btn ui-tactile-btn--destructive inline-flex h-8 items-center justify-center rounded-md px-2.5 text-xs font-medium text-white">Report issue</button>
    <button type="button" class="ui-tactile-btn ui-tactile-btn--primary inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium">Primary OK</button>
    <button type="button" class="ui-tactile-btn ui-tactile-btn--secondary inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium">Secondary</button>
  `
  document.body.appendChild(wrap)
})

await page.waitForTimeout(200)
const metrics = await page.evaluate(() =>
  [...document.querySelectorAll('#tactile-audit button')].map((b) => {
    const cs = getComputedStyle(b)
    return {
      text: b.textContent.trim(),
      surface: cs.getPropertyValue('--tactile-btn-surface').trim(),
      edge: cs.getPropertyValue('--tactile-btn-edge').trim(),
      shadow: cs.boxShadow,
    }
  }),
)
await page.screenshot({
  path: resolve(out, 'tactile-edge-destructive-fix-1280x800.png'),
  fullPage: false,
})
console.log(JSON.stringify(metrics, null, 2))
await browser.close()
