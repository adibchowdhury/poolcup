/**
 * Step conflict resolution fixture — realistic step 2–5 markup, 800 + 680.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import http from 'http'
import path from 'path'

const OUT = path.resolve('tmp/step-conflicts')
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
const cssHref = [...home.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map(
  (m) => m[1],
)[0]
const bundledCss = await get(cssHref)
const globalsCss = fs.readFileSync(
  path.resolve('app/globals.css'),
  'utf8',
)
// Tailwind bundle may lag HMR — append modal step rules from source for accurate measure.
const extraCss =
  globalsCss.slice(
    globalsCss.indexOf('/* Step 2 modal'),
    globalsCss.indexOf('.create-pool-wizard--modal .create-pool-plan-card__body {'),
  ) +
  globalsCss.slice(
    globalsCss.indexOf('/* Step 5 modal'),
    globalsCss.indexOf('.create-pool-review-summary__section {'),
  )

function scoringCard(label, rows) {
  const lis = rows
    .map(
      (r) =>
        `<li class="flex h-[18px] items-center justify-between gap-3"><span class="text-[12px]">${r}</span><span class="text-[12px] font-semibold text-primary">+${r === 'Miss' ? '0' : '3'}</span></li>`,
    )
    .join('')
  return `<button type="button" class="create-pool-scoring-style-card relative flex flex-1 flex-col rounded-xl items-center px-4 pt-3 text-center border border-[#1e2d3d]">
    <span class="create-pool-scoring-mascot flex items-center justify-center rounded-lg bg-[#1a1a1a]"></span>
    <p class="text-base font-semibold text-[#f0f4f8]">${label}</p>
    <p class="mt-1.5 text-sm font-medium leading-snug text-[#f0f4f8]/90">Predict every score</p>
    <p class="mt-1 text-xs leading-snug text-[#F2C94C]">Most competitive</p>
    <div class="create-pool-inset-panel mt-4 w-full text-left">
      <p class="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a7080]">Points System</p>
      <ul class="flex min-h-[66px] flex-col gap-1.5 ${rows.length === 3 ? 'justify-start' : 'justify-center'}">${lis}</ul>
    </div>
  </button>`
}

function stepBody(step) {
  if (step === 1)
    return `<div style="height:280px;display:flex;align-items:center;justify-content:center;color:#5a7080">Step 1 proxy</div>`
  if (step === 2)
    return `<div class="create-pool-step2-layout flex min-h-0 flex-col">
      <div class="mt-2 flex shrink-0 flex-col items-start gap-3 overflow-y-auto lg:mt-0 lg:flex-row lg:gap-4">
        ${scoringCard('Classic', ['Exact', 'Winner', 'Draw'])}
        ${scoringCard('Winner Only', ['Winner', 'Draw'])}
      </div>
      <p class="shrink-0 pt-3 text-center text-[12px] leading-snug text-[#5a7080]">Want different scoring? Custom scoring is available with <a href="/pricing" class="font-medium text-[#F2C94C]">Custom Pools</a>.</p>
    </div>`
  if (step === 3)
    return `<div class="create-pool-step3-layout flex h-full min-h-0 gap-5">
      <aside class="flex w-[42%] shrink-0 flex-col items-center justify-center px-2 text-center">
        <div class="relative flex h-[clamp(14.5rem,38vh,17rem)] w-[clamp(14.5rem,38vh,17rem)] items-center justify-center rounded-full bg-[#1a1a1a]"></div>
        <p class="mt-4 max-w-[16rem] text-sm leading-snug text-[#5a7080]">Give your pool a name and decide who gets to join.</p>
      </aside>
      <div class="create-pool-step3-divider w-px shrink-0 bg-white/[0.06]" aria-hidden></div>
      <div class="create-pool-step3-form flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-y-auto py-1 pr-1">
        <div class="create-pool-step3-field"><label for="pool-name" class="create-pool-step3-field-label block font-medium uppercase tracking-wider text-[#E5E7EB]">Pool name</label>
        <input id="pool-name" class="w-full rounded-xl border border-[#292929] bg-[#151515] py-3.5 pl-4 text-[17px]" value="Marketing Team WC 2026"/></div>
        <div class="create-pool-step3-field"><label for="pool-description" class="create-pool-step3-field-label block font-medium uppercase tracking-wider text-[#E5E7EB]">Description</label>
        <textarea id="pool-description" class="w-full resize-none rounded-lg border border-[#292929] bg-[#151515] px-3.5 py-2.5 text-sm"></textarea></div>
        <div class="create-pool-step3-field"><p class="create-pool-step3-field-label block font-medium uppercase tracking-wider text-[#E5E7EB]">Visibility</p>
        <div class="create-pool-visibility-toggle"><button type="button" class="create-pool-visibility-toggle__segment create-pool-visibility-toggle__segment--on"><svg class="create-pool-visibility-toggle__icon" viewBox="0 0 16 16"></svg>Private</button><button type="button" class="create-pool-visibility-toggle__segment create-pool-visibility-toggle__segment--off"><svg class="create-pool-visibility-toggle__icon" viewBox="0 0 16 16"></svg>Public</button></div>
        <div class="create-pool-visibility-hint"><p class="flex items-start justify-center gap-2 text-xs"><svg viewBox="0 0 16 16"></svg>Only people with the invite link can join.</p></div></div>
      </div>
    </div>`
  if (step === 4) {
    const li = (t) =>
      `<li class="flex items-start gap-2"><span class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm bg-primary/40"></span><span>${t}</span></li>`
    const basicFeatures = [
      'Predictions & leaderboard',
      'Invites & chat',
      'Standard scoring',
      'Basic pool controls',
      'Unlimited pools',
    ]
      .map(li)
      .join('')
    const customFeatures = [
      'Custom scoring rules',
      'Advanced commissioner tools',
      'Branding & customization',
      'Export Pool Results',
    ]
      .map(li)
      .join('')
    return `<div class="create-pool-plan-grid overflow-visible" role="radiogroup">
      <div class="create-pool-plan-card border-2 border-[#363636] bg-[#151515] rounded-xl p-4">
        <p class="create-pool-plan-card__title">Basic Pool</p>
        <p class="create-pool-plan-card__price create-pool-plan-card__price--basic">Free</p>
        <p class="create-pool-plan-card__tagline create-pool-plan-card__tagline--muted">For friends and groups who just want to play.</p>
        <div class="create-pool-plan-card__body"><p class="create-pool-plan-card__features-label">Includes:</p>
        <ul class="create-pool-plan-card__features flex flex-col gap-2 text-[12.5px]">${basicFeatures}</ul>
        <button type="button" class="create-pool-plan-card__select create-pool-plan-card__select--idle mt-4 h-9 w-full rounded-lg">Select Basic</button></div>
      </div>
      <div class="create-pool-plan-card create-pool-plan-card--custom rounded-xl p-4 bg-[#222220]">
        <span class="create-pool-plan-card__badge">Best for commissioners</span>
        <p class="create-pool-plan-card__title">Custom Pool</p>
        <p class="create-pool-plan-card__price-line"><span class="create-pool-plan-card__price create-pool-plan-card__price--custom">$9.99</span><span class="create-pool-plan-card__price-note">one-time</span></p>
        <p class="create-pool-plan-card__tagline create-pool-plan-card__tagline--muted">For commissioners who want full control.</p>
        <div class="create-pool-plan-card__body"><p class="create-pool-plan-card__features-label">Everything in Free, PLUS:</p>
        <ul class="create-pool-plan-card__features flex flex-col gap-1.5 text-[12.5px]">${customFeatures}</ul>
        <button type="button" class="create-pool-plan-card__select create-pool-plan-card__select--idle mt-4 h-9 w-full rounded-lg">Select Custom</button></div>
      </div>
    </div>`
  }
  return `<div class="create-pool-step5-layout shrink-0"><div data-testid="create-pool-review-summary" class="create-pool-review-summary--modal mx-auto w-full max-w-[28.75rem] shrink-0 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c]" style="min-height:280px"></div></div>`
}

function shellHtml(step, viewportH, title) {
  const modalH = Math.min(760, viewportH * 0.9, viewportH - 48)
  return `<!DOCTYPE html><html><head><style>${bundledCss}\n${extraCss}
    body{margin:0;background:#0a0a0a;font-family:Inter,system-ui,sans-serif}
    .overlay{width:1280px;height:${viewportH}px;display:flex;align-items:center;justify-content:center;padding:1.5rem;box-sizing:border-box}
  </style></head><body><div class="overlay">
    <div class="create-pool-wizard--modal create-pool-wizard--modal-ticket-shell relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#292929] bg-[#111111] p-8 shadow-2xl" style="height:${modalH}px">
      <header class="shrink-0"><div style="display:flex;justify-content:center;margin-bottom:2rem;color:#5a7080;font-size:12px">● ● ● ● ●</div>
        <h1 class="text-center font-display text-2xl tracking-wide text-foreground mt-8">${title}</h1></header>
      <div data-create-pool-slide-viewport class="relative z-[2] mt-8 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden">
        <div data-create-pool-pane="left" class="flex h-full min-h-0 flex-1 flex-col px-1.5">${stepBody(step)}</div>
      </div>
      <footer class="relative z-[2] flex shrink-0 flex-col justify-end pt-4">
        <div style="height:1px;margin-bottom:1rem;background:repeating-linear-gradient(to right,#454542 0,#454542 4px,transparent 4px,transparent 9px)"></div>
        <div style="display:flex;gap:.75rem"><button style="flex:0 0 38%;height:2.5rem;border-radius:.5rem;border:1px solid #292929;background:transparent;color:#e8edf3">Back</button>
        <button style="flex:1;height:2.5rem;border-radius:.5rem;border:none;background:#00e676;color:#0a0a0a;font-weight:600">Continue</button></div>
      </footer>
    </div></div></body></html>`
}

const titles = [
  'Choose a competition',
  'How do you want to play?',
  'Set up your pool',
  'Choose your pool experience',
  'Review and create your pool',
]

const browser = await chromium.launch({ headless: true })
const results = []

for (const vp of [
  { name: '800', h: 800 },
  { name: '680', h: 680 },
]) {
  const perforations = []
  for (const step of [1, 2, 3, 4, 5]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: vp.h } })
    await page.setContent(shellHtml(step, vp.h, titles[step - 1]), { waitUntil: 'load' })
    await page.waitForTimeout(200)

    const m = await page.evaluate((stepNum) => {
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
      const perfY = shellRect.top + shellRect.height - footerPx
      const contentBottom = [...pane.querySelectorAll('*')].reduce(
        (max, el) => {
          const r = el.getBoundingClientRect()
          if (r.height <= 0) return max
          const st = getComputedStyle(el)
          if (st.position === 'absolute' || st.visibility === 'hidden') return max
          return Math.max(max, r.bottom)
        },
        pane.getBoundingClientRect().top,
      )
      const out = {
        footerPx,
        perforationY: Math.round(perfY),
        contentBottom: Math.round(contentBottom),
        overflowPx: Math.round(contentBottom - perfY),
      }
      if (stepNum === 2) {
        const cards = [...pane.querySelectorAll('.create-pool-scoring-style-card')]
        out.scoringCards = cards.map((c) => ({
          label: c.querySelector('p')?.textContent?.trim(),
          heightPx: Math.round(c.getBoundingClientRect().height),
        }))
        const disc = pane.querySelector('p.shrink-0')
        if (disc && cards.length)
          out.disclaimerOffsetPx = Math.round(
            disc.getBoundingClientRect().top -
              Math.max(...cards.map((c) => c.getBoundingClientRect().bottom)),
          )
      }
      if (stepNum === 3) {
        const div = pane.querySelector('.create-pool-step3-divider')
        if (div) out.dividerClearancePx = Math.round(perfY - div.getBoundingClientRect().bottom)
        const label = pane.querySelector('.create-pool-step3-field-label')
        const input = pane.querySelector('#pool-name')
        const desc = pane.querySelector('#pool-description')
        const seg = pane.querySelector('.create-pool-visibility-toggle__segment')
        if (label) out.labelFontSize = getComputedStyle(label).fontSize
        if (input) {
          const cs = getComputedStyle(input)
          out.inputFontSize = cs.fontSize
          out.inputPadding = cs.padding
        }
        if (desc) out.textareaFontSize = getComputedStyle(desc).fontSize
        if (seg) out.toggleFontSize = getComputedStyle(seg).fontSize
      }
      if (stepNum === 4) {
        const grid = pane.querySelector('.create-pool-plan-grid')
        const custom = pane.querySelector('.create-pool-plan-card--custom')
        const badge = pane.querySelector('.create-pool-plan-card__badge')
        const slide = document.querySelector('[data-create-pool-slide-viewport]')
        if (grid) out.planGridMarginTop = getComputedStyle(grid).marginTop
        if (custom) {
          out.customCardBottom = Math.round(custom.getBoundingClientRect().bottom)
          out.cardsToLinePx = Math.round(perfY - custom.getBoundingClientRect().bottom)
        }
        if (badge && slide)
          out.badgeTopClearancePx = Math.round(
            badge.getBoundingClientRect().top - slide.getBoundingClientRect().top,
          )
      }
      if (stepNum === 5) {
        const card = pane.querySelector('.create-pool-review-summary--modal')
        const slide = document.querySelector('[data-create-pool-slide-viewport]')
        if (card && slide) {
          const cr = card.getBoundingClientRect()
          const sr = slide.getBoundingClientRect()
          out.gapAbovePx = Math.round(cr.top - sr.top)
          out.gapBelowPx = Math.round(perfY - cr.bottom)
          out.gapDeltaPx = Math.round(Math.abs(out.gapAbovePx - out.gapBelowPx))
        }
      }
      return out
    }, step)

    const file = path.join(OUT, `fixture-step-${step}-${vp.name}.png`)
    await page.screenshot({ path: file })
    await page.close()
    perforations.push(m.perforationY)
    results.push({ viewport: vp.name, step, ...m })
  }
  console.log(`${vp.name} perforations: ${perforations.join(', ')}`)
}

await browser.close()
console.log(JSON.stringify(results, null, 2))

const r800 = results.filter((r) => r.viewport === '800')
const r680 = results.filter((r) => r.viewport === '680')
const perfOk = r800.every((r) => r.perforationY === r800[0].perforationY)
const col800 = r800.filter((r) => r.overflowPx > 1)
const col680 = r680.filter((r) => r.overflowPx > 1)
console.log(perfOk && col800.length === 0 ? 'PASS 800' : `800 issues: ${col800.map((c) => `s${c.step}+${c.overflowPx}`).join(', ') || 'perf'}`)
console.log(col680.length === 0 ? 'PASS 680' : `680 issues: ${col680.map((c) => `s${c.step}+${c.overflowPx}`).join(', ')}`)
process.exit(perfOk && col800.length === 0 && col680.length === 0 ? 0 : 1)
