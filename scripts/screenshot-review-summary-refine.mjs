/**
 * Refinement verification — zero-scroll at 1280×800, 680 overflow report.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import http from 'http'
import path from 'path'

const OUT = path.resolve('tmp/review-summary-refine')
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
  return `<ul class="create-pool-review-summary__scoring">${rows
    .map(
      ([icon, label, pts]) =>
        `<li><span aria-hidden>${icon}</span><span class="create-pool-review-summary__scoring-label">${label}</span><span class="create-pool-review-summary__scoring-points">${pts}</span></li>`,
    )
    .join('')}</ul>`
}

function row(label, value) {
  return `<div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">${label}</dt><dd class="create-pool-review-summary__value">${value}</dd></div>`
}

function section(rows) {
  return `<section class="create-pool-review-summary__section"><dl class="create-pool-review-summary__fields">${rows}</dl></section>`
}

function ticketHtml({ plan, type, viewportH }) {
  const modalH = Math.min(760, viewportH * 0.9, viewportH - 48)
  const planRows =
    plan === 'custom'
      ? `${row('Plan', 'Custom Pool')}${row('Price', '<span class="create-pool-review-summary__value--gold">$9.99 one-time</span>')}`
      : `${row('Plan', 'Basic Pool')}${row('Price', 'Free')}`

  const card = `<div class="create-pool-review-summary--modal mx-auto mt-0 w-full shrink-0 rounded-xl border border-[#2a2a2a]" data-testid="create-pool-review-summary">
    ${section(`${row('Sport', '<span class="create-pool-review-summary__value-inline">⚽ <span>Soccer</span></span>')}${row('Competition / Event', '<span class="create-pool-review-summary__value-inline">🏟️ <span>La Liga · 2026/27</span></span>')}`)}
    ${section(`${row('Pool Type', type === 'winner' ? 'Winner Only' : 'Score Predictor')}${row('Scoring Rules', scoringRows(type))}`)}
    ${section(`${row('Pool Name', 'Office World Cup Pool')}${row('Description', '<span class="create-pool-review-summary__value--placeholder">No description</span>')}${row('Visibility', '<span class="create-pool-review-summary__value-inline">🔒 <span>Private</span></span>')}`)}
    ${section(planRows)}
  </div>`

  const ctaLabel =
    plan === 'custom' ? 'Upgrade & Create · $9.99' : 'Create My Pool →'

  return `<!DOCTYPE html><html><head><style>${bundledCss}
    body{margin:0;background:#0a0a0a;font-family:Inter,system-ui,sans-serif}
    .overlay{width:1280px;height:${viewportH}px;display:flex;align-items:center;justify-content:center;padding:1.5rem;box-sizing:border-box}
  </style></head><body><div class="overlay">
    <div class="create-pool-wizard--modal create-pool-wizard--modal-ticket-shell relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#292929] bg-[#111111] p-8 shadow-2xl" style="height:${modalH}px">
      <header class="shrink-0"><div style="display:flex;justify-content:center;gap:.5rem;margin-bottom:2rem;color:#5a7080;font-size:12px">● ● ● ● ●</div>
        <h1 class="text-center font-display text-2xl tracking-wide text-foreground mt-8">Review and create your pool</h1></header>
      <div class="relative z-[2] mt-8 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden">
        <div class="flex h-full min-h-0 flex-1 flex-col items-center">${card}
          <p class="create-pool-review-reassurance">You can change these settings later.</p>
        </div>
      </div>
      <footer class="relative z-[2] flex shrink-0 flex-col justify-end pt-4"><div style="height:1px;margin-bottom:1rem;background:repeating-linear-gradient(to right,#454542 0,#454542 4px,transparent 4px,transparent 9px)"></div>
        <div style="display:flex;gap:.75rem"><button style="flex:0 0 38%;height:2.5rem;border-radius:.5rem;border:1px solid #292929;background:transparent">Back</button>
        <button style="flex:1;height:2.5rem;border-radius:.5rem;border:none;background:#00e676;color:#0a0a0a;font-weight:600">${ctaLabel}</button></div></footer>
    </div></div></body></html>`
}

const browser = await chromium.launch({ headless: true })

async function verify(name, plan, type, viewportH) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: viewportH },
  })
  await page.setContent(ticketHtml({ plan, type, viewportH }), {
    waitUntil: 'load',
  })
  await page.waitForTimeout(250)

  const metrics = await page.evaluate(() => {
    const modal = document.querySelector('.create-pool-wizard--modal-ticket-shell')
    const card = document.querySelector('[data-testid="create-pool-review-summary"]')
    const reassurance = document.querySelector('.create-pool-review-reassurance')
    const planValue = [...card.querySelectorAll('.create-pool-review-summary__row')]
      .find((r) => r.textContent.includes('Plan'))
      ?.querySelector('.create-pool-review-summary__value')
    const priceValue = card.querySelector('.create-pool-review-summary__value--gold')
    const flameInPlan = planValue?.querySelector('svg, [class*="Flame"]')
    const modalRect = modal.getBoundingClientRect()
    const stubY = parseFloat(getComputedStyle(modal).getPropertyValue('--stub-y') || '0')
    const perforationY = stubY > 0 ? modalRect.top + stubY : modalRect.bottom - 96
    const reassuranceRect = reassurance?.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const section = card.querySelector('.create-pool-review-summary__section')
    const root = card
    const rs = getComputedStyle(root)
    return {
      sectionPadding: section ? getComputedStyle(section).padding : null,
      fieldsGap: getComputedStyle(
        section.querySelector('.create-pool-review-summary__fields'),
      ).gap,
      sectionPy: rs.getPropertyValue('--create-pool-review-section-py').trim(),
      rowGap: rs.getPropertyValue('--create-pool-review-row-gap').trim(),
      scoringGap: rs
        .getPropertyValue('--create-pool-review-scoring-line-gap')
        .trim(),
      planHasFlame: Boolean(flameInPlan),
      planColor: planValue ? getComputedStyle(planValue).color : null,
      priceColor: priceValue ? getComputedStyle(priceValue).color : null,
      reassuranceText: reassurance?.textContent?.trim(),
      reassuranceFontSize: reassurance
        ? getComputedStyle(reassurance).fontSize
        : null,
      reassuranceColor: reassurance
        ? getComputedStyle(reassurance).color
        : null,
      reassurancePaddingTop: reassurance
        ? getComputedStyle(reassurance).paddingTop
        : null,
      reassurancePaddingBottom: reassurance
        ? getComputedStyle(reassurance).paddingBottom
        : null,
      reassuranceAbovePerforation:
        reassuranceRect != null && reassuranceRect.bottom <= perforationY + 2,
      cardBottomAbovePerforation: cardRect.bottom <= perforationY + 2,
      overflowBelowPerforation:
        Math.max(
          card.getBoundingClientRect().bottom,
          reassuranceRect?.bottom ?? 0,
        ) - perforationY,
      zeroScroll:
        modal.scrollHeight <= modal.clientHeight + 1 &&
        getComputedStyle(card).overflowY === 'visible',
      cardHeight: Math.round(cardRect.height),
    }
  })

  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  await page.close()
  console.log(JSON.stringify({ name, file, metrics }, null, 2))
  return metrics
}

const results = [
  await verify('basic-800', 'basic', 'classic', 800),
  await verify('custom-800', 'custom', 'winner', 800),
  await verify('basic-680', 'basic', 'classic', 680),
  await verify('custom-680', 'custom', 'winner', 680),
]

const pass800 = results
  .filter((_, i) => i < 2)
  .every(
    (m) =>
      m.zeroScroll &&
      m.overflowBelowPerforation <= 0 &&
      !m.planHasFlame &&
      m.reassuranceText === 'You can change these settings later.',
  )

const overflow680 = results
  .filter((_, i) => i >= 2)
  .map((m) => m.overflowBelowPerforation)

console.log(
  pass800
    ? `PASS 800 — zero scroll, both plans. 680 overflow: ${overflow680.join(', ')}px`
    : 'FAIL 800',
)
await browser.close()
process.exit(pass800 ? 0 : 1)
