/**
 * Stub raise verification — fixture shell, steps 1–5 content proxies, 800 + 680.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import http from 'http'
import path from 'path'

const OUT = path.resolve('tmp/ticket-stub-steps')
fs.mkdirSync(OUT, { recursive: true })

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
const cssHref = [
  ...home.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g),
].map((m) => m[1])[0]
const bundledCss = await get(cssHref)

function stepBody(step) {
  if (step === 1)
    return `<div style="height:280px;display:flex;align-items:center;justify-content:center;color:#5a7080">Competition step proxy</div>`
  if (step === 2)
    return `<div class="flex h-full min-h-0 flex-col"><div class="min-h-0 flex-1 overflow-y-auto"><div style="height:340px;background:#151515;border-radius:12px"></div></div><p class="shrink-0 pt-3 text-center text-[12px] text-[#5a7080]">Want different scoring? Custom scoring is available with Custom Pools.</p></div>`
  if (step === 3)
    return `<div style="height:300px;display:flex;align-items:center;justify-content:center;color:#5a7080">Pool details step proxy</div>`
  if (step === 4)
    return `<div><div style="height:360px;background:#151515;border-radius:12px"></div></div>`
  return `<div data-testid="create-pool-review-summary" class="create-pool-review-summary--modal mx-auto w-full shrink-0 rounded-xl border border-[#2a2a2a]" style="height:320px"></div>`
}

function shellHtml(step, viewportH, ctaLabel) {
  const modalH = Math.min(760, viewportH * 0.9, viewportH - 48)
  return `<!DOCTYPE html><html><head><style>${bundledCss}
    body{margin:0;background:#0a0a0a;font-family:Inter,system-ui,sans-serif}
    .overlay{width:1280px;height:${viewportH}px;display:flex;align-items:center;justify-content:center;padding:1.5rem;box-sizing:border-box}
  </style></head><body><div class="overlay">
    <div class="create-pool-wizard--modal create-pool-wizard--modal-ticket-shell relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#292929] bg-[#111111] p-8 shadow-2xl" style="height:${modalH}px" data-step="${step}">
      <header class="shrink-0"><div style="display:flex;justify-content:center;margin-bottom:2rem;color:#5a7080;font-size:12px">● ● ● ● ●</div>
        <h1 class="text-center font-display text-2xl tracking-wide text-foreground mt-8">Review and create your pool</h1></header>
      <div data-create-pool-slide-viewport class="relative z-[2] mt-8 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden">
        <div data-create-pool-pane="left" class="flex h-full min-h-0 flex-1 flex-col px-1.5">${stepBody(step)}</div>
      </div>
      <footer class="relative z-[2] flex shrink-0 flex-col justify-end pt-4">
        <div style="height:1px;margin-bottom:1rem;background:repeating-linear-gradient(to right,#454542 0,#454542 4px,transparent 4px,transparent 9px)"></div>
        <div style="display:flex;gap:.75rem"><button style="flex:0 0 38%;height:2.5rem;border-radius:.5rem;border:1px solid #292929;background:transparent;color:#e8edf3">Back</button>
        <button style="flex:1;height:2.5rem;border-radius:.5rem;border:none;background:#00e676;color:#0a0a0a;font-weight:600">${ctaLabel}</button></div>
      </footer>
    </div></div></body></html>`
}

const browser = await chromium.launch({ headless: true })
const results = []

for (const vp of [
  { name: '800', h: 800 },
  { name: '680', h: 680 },
]) {
  const perforations = []
  for (const step of [1, 2, 3, 4, 5]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: vp.h },
    })
    const cta = step === 5 ? 'Upgrade & Create · $9.99' : 'Continue'
    await page.setContent(shellHtml(step, vp.h, cta), { waitUntil: 'load' })
    await page.waitForTimeout(150)

    const m = await page.evaluate(() => {
      const shell = document.querySelector('.create-pool-wizard--modal-ticket-shell')
      const pane = document.querySelector('[data-create-pool-pane="left"]')
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
      const paneRect = pane.getBoundingClientRect()
      const contentBottom = [...pane.querySelectorAll('*')].reduce(
        (max, el) => Math.max(max, el.getBoundingClientRect().bottom),
        paneRect.top,
      )
      const reassurance = document.querySelector('.create-pool-review-reassurance')
      const card = document.querySelector('.create-pool-review-summary--modal')
      const scoringGap = card
        ? getComputedStyle(card)
            .getPropertyValue('--create-pool-review-scoring-line-gap')
            .trim()
        : null
      return {
        footerPx,
        perforationY: Math.round(perforationY),
        contentBottom: Math.round(contentBottom),
        overflowPx: Math.round(contentBottom - perforationY),
        reassurancePresent: Boolean(reassurance),
        scoringLineGap: scoringGap,
      }
    })

    const file = path.join(OUT, `step-${step}-${vp.name}.png`)
    await page.screenshot({ path: file })
    await page.close()
    perforations.push(m.perforationY)
    results.push({ viewport: vp.name, step, file, ...m })
  }
  console.log(`${vp.name} perforations: ${perforations.join(', ')}`)
}

await browser.close()

const r800 = results.filter((r) => r.viewport === '800')
const perf800 = r800.map((r) => r.perforationY)
const pass800 =
  perf800.every((p) => p === perf800[0]) &&
  r800.every((r) => r.overflowPx <= 2 && !r.reassurancePresent)
const r680coll = results.filter((r) => r.viewport === '680' && r.overflowPx > 2)

console.log(JSON.stringify(results, null, 2))
console.log(
  pass800
    ? `PASS 800 — stub region ${r800[0].footerPx}px, perforation ${perf800[0]}px`
    : 'FAIL 800',
)
if (r680coll.length)
  console.log(
    `680 overflow: ${r680coll.map((r) => `step${r.step}:${r.overflowPx}px`).join(', ')}`,
  )
else console.log('PASS 680 — no collisions in fixture')

process.exit(pass800 ? 0 : 1)
