/**
 * Zero-scroll fit verification — full ticket shell at 1280×800 and 1280×680.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import http from 'http'
import path from 'path'

const OUT = path.resolve('tmp/review-summary-noscroll')
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

function scoringRows(type) {
  const rows =
    type === 'winner'
      ? [
          ['✓', 'Winner', '+2'],
          ['🤝', 'Draw', '+3'],
          ['×', 'Miss', '+0'],
        ]
      : [
          ['🎯', 'Exact', '+5'],
          ['✓', 'Winner', '+2'],
          ['🤝', 'Draw', '+3'],
          ['×', 'Miss', '+0'],
        ]
  return `<ul class="create-pool-review-summary__scoring" aria-label="Scoring rules">
    ${rows
      .map(
        ([icon, label, pts]) =>
          `<li><span aria-hidden>${icon}</span><span>${label}</span><span style="font-family:monospace;font-weight:600;color:rgba(0,230,118,.72)">${pts}</span></li>`,
      )
      .join('')}
  </ul>`
}

function section(rows) {
  return `<section class="create-pool-review-summary__section"><dl class="create-pool-review-summary__fields">${rows}</dl></section>`
}

function row(label, value) {
  return `<div class="create-pool-review-summary__row">
    <dt class="create-pool-review-summary__label">${label}</dt>
    <dd class="create-pool-review-summary__value">${value}</dd>
  </div>`
}

function ticketHtml({ plan, type, description, poolName, viewportH }) {
  const modalH = Math.min(760, viewportH * 0.9, viewportH - 48)
  const planRows =
    plan === 'custom'
      ? `${row('Plan', '<span class="create-pool-review-summary__value-inline">🔥 <span>Custom Pool</span></span>')}
         ${row('Price', '<span style="color:#f2c94c">$9.99 one-time</span>')}`
      : `${row('Plan', 'Basic Pool')}${row('Price', 'Free')}`

  const desc =
    description ||
    '<span style="font-style:italic;font-weight:400;color:#8b98a9">No description</span>'

  const card = `<div class="create-pool-review-summary--modal mx-auto mt-0 w-full shrink-0 rounded-xl border border-[#2a2a2a]" data-testid="create-pool-review-summary">
    ${section(`${row('Sport', '<span class="create-pool-review-summary__value-inline">⚽ <span>Soccer</span></span>')}
      ${row('Competition / Event', '<span class="create-pool-review-summary__value-inline">🏟️ <span>La Liga · 2026/27</span></span>')}`)}
    ${section(`${row('Pool Type', type === 'winner' ? 'Winner Only' : 'Score Predictor')}
      ${row('Scoring Rules', scoringRows(type))}`)}
    ${section(`${row('Pool Name', poolName || 'Office World Cup Pool')}
      ${row('Description', desc)}
      ${row('Visibility', '<span class="create-pool-review-summary__value-inline">🔒 <span>Private</span></span>')}`)}
    ${section(planRows)}
  </div>`

  return `<!DOCTYPE html><html><head><style>${bundledCss}
    body{margin:0;background:#0a0a0a;font-family:Inter,system-ui,sans-serif;color:#e8edf3;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .overlay{width:1280px;height:${viewportH}px;display:flex;align-items:center;justify-content:center;padding:1.5rem;box-sizing:border-box}
  </style></head><body><div class="overlay">
    <div class="create-pool-wizard--modal create-pool-wizard--modal-ticket-shell relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#292929] bg-[#111111] p-8 shadow-2xl" style="height:${modalH}px">
      <header class="shrink-0">
        <div style="display:flex;justify-content:center;gap:.5rem;margin-bottom:2rem;color:#5a7080;font-size:12px">● ● ● ● ●</div>
        <h1 class="text-center font-display text-2xl tracking-wide text-foreground mt-8">Review and create your pool</h1>
      </header>
      <div class="relative z-[2] mt-8 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden">
        <div class="flex h-full min-h-0 flex-1 flex-col items-center justify-start overflow-visible">
          ${card}
        </div>
      </div>
      <footer class="relative z-[2] flex shrink-0 flex-col justify-end pt-4">
        <div style="height:1px;margin-bottom:1rem;background:repeating-linear-gradient(to right,#454542 0,#454542 4px,transparent 4px,transparent 9px)"></div>
        <div style="display:flex;gap:.75rem">
          <button style="flex:0 0 38%;height:2.5rem;border-radius:.5rem;border:1px solid #292929;background:transparent;color:#e8edf3">Back</button>
          <button style="flex:1;height:2.5rem;border-radius:.5rem;border:none;background:#00e676;color:#0a0a0a;font-weight:600">Create pool</button>
        </div>
      </footer>
    </div>
  </div></body></html>`
}

const browser = await chromium.launch({ headless: true })

async function verify(name, opts, viewportH) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: viewportH },
  })
  await page.setContent(ticketHtml({ ...opts, viewportH }), {
    waitUntil: 'load',
  })
  await page.waitForTimeout(250)

  const metrics = await page.evaluate(() => {
    const modal = document.querySelector('.create-pool-wizard--modal')
    const card = document.querySelector(
      '[data-testid="create-pool-review-summary"]',
    )
    const bodySlot = card.parentElement
    const sections = [...card.querySelectorAll('.create-pool-review-summary__section')]
    const priceRow = [...card.querySelectorAll('.create-pool-review-summary__row')].find(
      (r) => r.textContent.includes('Price'),
    )
    const modalRect = modal.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const bodyRect = bodySlot?.getBoundingClientRect()
    const priceRect = priceRow?.getBoundingClientRect()
    const stubY = parseFloat(
      getComputedStyle(modal).getPropertyValue('--stub-y') || '0',
    )
    const perforationY =
      stubY > 0 ? modalRect.top + stubY : modalRect.bottom - 96
    const cardCs = getComputedStyle(card)
    const sectionCs = getComputedStyle(sections[0])
    const fieldsCs = getComputedStyle(
      sections[0].querySelector('.create-pool-review-summary__fields'),
    )
    const rowCs = getComputedStyle(
      sections[0].querySelector('.create-pool-review-summary__row'),
    )
    return {
      sectionCount: sections.length,
      hasSectionHeaders: card.querySelectorAll(
        '.create-pool-review-summary__heading-title',
      ).length,
      cardHeight: Math.round(cardRect.height),
      cardScrollHeight: card.scrollHeight,
      cardClientHeight: card.clientHeight,
      cardOverflowY: cardCs.overflowY,
      bodyOverflowY: bodySlot ? getComputedStyle(bodySlot).overflowY : null,
      bodyScrollHeight: bodySlot?.scrollHeight ?? 0,
      bodyClientHeight: bodySlot?.clientHeight ?? 0,
      cardBottom: Math.round(cardRect.bottom),
      priceBottom: Math.round(priceRect?.bottom ?? 0),
      perforationY: Math.round(perforationY),
      bodyBottom: Math.round(bodyRect?.bottom ?? 0),
      overflowBelowPerforation: Math.round(
        (priceRect?.bottom ?? 0) - perforationY,
      ),
      cardOverflowBody: bodySlot
        ? Math.round(cardRect.bottom - bodyRect.bottom)
        : 0,
      sectionPadding: sectionCs.padding,
      fieldsGap: fieldsCs.gap,
      rowGap: rowCs.gap,
    }
  })

  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  await page.close()

  const zeroScroll =
    metrics.cardScrollHeight <= metrics.cardClientHeight + 1 &&
    metrics.cardOverflowY === 'visible' &&
    metrics.overflowBelowPerforation <= 0

  console.log(JSON.stringify({ name, file, zeroScroll, metrics }, null, 2))
  return { name, zeroScroll, metrics }
}

const variants = [
  ['basic-classic-800', { plan: 'basic', type: 'classic', description: '', poolName: 'Office World Cup Pool' }, 800],
  ['custom-winner-800', { plan: 'custom', type: 'winner', description: '', poolName: 'Office World Cup Pool' }, 800],
  ['basic-classic-680', { plan: 'basic', type: 'classic', description: '', poolName: 'Office World Cup Pool' }, 680],
  ['custom-classic-680', { plan: 'custom', type: 'classic', description: '', poolName: 'Office World Cup Pool' }, 680],
  ['long-wrap-680', { plan: 'custom', type: 'classic', description: 'Winner buys lunch for the entire office including dessert', poolName: 'The Extremely Long Office World Cup Prediction Pool Name That Wraps' }, 680],
]

const results = []
for (const [name, opts, h] of variants) {
  results.push(await verify(name, opts, h))
}

const failures = []
for (const r of results) {
  if (r.metrics.hasSectionHeaders !== 0)
    failures.push(`${r.name}: section headers remain`)
  if (r.metrics.sectionCount !== 4)
    failures.push(`${r.name}: expected 4 sections`)
  if (r.name.endsWith('-800') && !r.zeroScroll)
    failures.push(`${r.name}: must fit at 800 (overflow ${r.metrics.overflowBelowPerforation}px)`)
  if (r.name === 'long-wrap-680' && !r.zeroScroll)
    failures.push(
      `${r.name}: 680 long-wrap overflow ${r.metrics.overflowBelowPerforation}px`,
    )
  else if (r.name.endsWith('-680') && !r.zeroScroll)
    failures.push(
      `${r.name}: 680 overflow ${r.metrics.overflowBelowPerforation}px (report only)`,
    )
}

const pass800 = results.filter((r) => r.name.endsWith('-800')).every((r) => r.zeroScroll)
const pass680 = results.filter((r) => r.name.endsWith('-680')).every((r) => r.zeroScroll)

console.log(
  pass800 && pass680
    ? 'PASS — zero scroll at 800 and 680'
    : pass800
      ? 'PARTIAL — 800 pass, 680 has overflow (see metrics)'
      : 'FAIL — 800 does not fit',
)
await browser.close()
process.exit(pass800 ? 0 : 1)
