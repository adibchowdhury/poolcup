/**
 * Measure step-5 review card gaps: title→card vs card→dashed line @1280×800.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import http from 'http'
import path from 'path'

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: 'localhost', port: 3000, path: urlPath }, (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      .on('error', reject)
  })
}

const home = await get('/')
const cssHref = [...home.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map(
  (m) => m[1],
)[0]
const bundledCss = await get(cssHref)
const globalsCss = fs.readFileSync(path.resolve('app/globals.css'), 'utf8')
const extraCss =
  globalsCss.slice(
    globalsCss.indexOf('/* Step 2 modal'),
    globalsCss.indexOf('.create-pool-wizard--modal .create-pool-plan-card__body {'),
  ) +
  globalsCss.slice(
    globalsCss.indexOf('/* Step 5 modal'),
    globalsCss.indexOf('.create-pool-review-summary__section {'),
  )

const modalH = Math.min(760, 800 * 0.9, 800 - 48)
const html = `<!DOCTYPE html><html><head><style>${bundledCss}\n${extraCss}
body{margin:0;background:#0a0a0a;font-family:Inter,system-ui,sans-serif}
.overlay{width:1280px;height:800px;display:flex;align-items:center;justify-content:center;padding:1.5rem;box-sizing:border-box}
</style></head><body><div class="overlay">
<div class="create-pool-wizard--modal create-pool-wizard--modal-ticket-shell relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#292929] bg-[#111111] p-8 shadow-2xl" style="height:${modalH}px">
<header class="shrink-0"><div style="display:flex;justify-content:center;margin-bottom:2rem;color:#5a7080;font-size:12px">● ● ● ● ●</div>
<h1 class="text-center font-display text-2xl tracking-wide text-foreground mt-8">Review and create your pool</h1></header>
<div data-create-pool-slide-viewport class="relative z-[2] mt-8 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden">
<div data-create-pool-pane="left" class="flex h-full min-h-0 flex-1 flex-col px-1.5">
<div class="create-pool-step5-layout shrink-0">
<div data-testid="create-pool-review-summary" class="create-pool-review-summary--modal mx-auto w-full max-w-[28.75rem] shrink-0 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c]" style="min-height:320px"></div>
</div></div></div>
<footer class="relative z-[2] flex shrink-0 flex-col justify-end pt-4">
<div style="height:1px;margin-bottom:1rem;background:repeating-linear-gradient(to right,#454542 0,#454542 4px,transparent 4px,transparent 9px)"></div>
<div style="display:flex;gap:.75rem"><button style="flex:1;height:2.5rem;border-radius:.5rem;border:none;background:#00e676">Upgrade & Create · $9.99</button></div>
</footer></div></div></body></html>`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.setContent(html, { waitUntil: 'load' })
await page.waitForTimeout(200)

const m = await page.evaluate(() => {
  const shell = document.querySelector('.create-pool-wizard--modal-ticket-shell')
  const title = shell?.querySelector('h1')
  const card = document.querySelector('.create-pool-review-summary--modal')
  const layout = document.querySelector('.create-pool-step5-layout')
  const shellRect = shell.getBoundingClientRect()
  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.height = getComputedStyle(shell).getPropertyValue(
    '--create-pool-modal-stub-footer-region',
  )
  document.body.appendChild(probe)
  const footerPx = probe.offsetHeight
  probe.remove()
  const perforationY = shellRect.top + shellRect.height - footerPx
  const titleBottom = title.getBoundingClientRect().bottom
  const cardRect = card.getBoundingClientRect()
  const layoutStyle = layout ? getComputedStyle(layout) : null
  return {
    perforationY: Math.round(perforationY),
    titleBottom: Math.round(titleBottom),
    cardTop: Math.round(cardRect.top),
    cardBottom: Math.round(cardRect.bottom),
    gapAboveTitleToCard: Math.round(cardRect.top - titleBottom),
    gapBelowCardToLine: Math.round(perforationY - cardRect.bottom),
    layoutTransform: layoutStyle?.transform ?? null,
    layoutMarginTop: layoutStyle?.marginTop ?? null,
  }
})

await page.screenshot({ path: path.resolve('tmp/step5-gaps-before.png') })
await browser.close()

console.log(JSON.stringify(m, null, 2))
