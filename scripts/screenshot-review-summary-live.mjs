/**
 * Screenshot verification — full modal ticket shell (not isolated card).
 * Confirms all four sections are visible above the perforation line.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import http from 'http'
import path from 'path'

const OUT = path.resolve('tmp/review-summary-live')
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

function section(title, icon, rows) {
  return `<section class="create-pool-review-summary__section">
    <header class="create-pool-review-summary__heading">
      <span class="create-pool-review-summary__heading-icon" aria-hidden>${icon}</span>
      <h3 class="create-pool-review-summary__heading-title">${title}</h3>
    </header>
    <dl class="create-pool-review-summary__fields">${rows}</dl>
  </section>`
}

function row(label, value) {
  return `<div class="create-pool-review-summary__row">
    <dt class="create-pool-review-summary__label">${label}</dt>
    <dd class="create-pool-review-summary__value">${value}</dd>
  </div>`
}

function ticketHtml({ plan, type, description, viewportH }) {
  const modalH = Math.min(760, viewportH * 0.9, viewportH - 48)
  const planRows =
    plan === 'custom'
      ? `${row('Plan', '<span class="create-pool-review-summary__value-inline">🔥 <span>Custom Pool</span></span>')}
         ${row('Price', '<span style="color:#f2c94c">$9.99 one-time</span>')}`
      : plan === 'basic'
        ? `${row('Plan', 'Basic Pool')}${row('Price', 'Free')}`
        : `${row('Plan', '<span style="font-style:italic;font-weight:400;color:#8b98a9">Not selected</span>')}
           ${row('Price', '<span style="font-style:italic;font-weight:400;color:#8b98a9">—</span>')}`

  const desc =
    description ||
    '<span style="font-style:italic;font-weight:400;color:#8b98a9">No description</span>'

  const card = `<div class="create-pool-review-summary--modal mx-auto mt-4 w-full rounded-xl border border-[#2a2a2a]" data-testid="create-pool-review-summary">
    ${section(
      'Competition',
      '🏆',
      `${row('Sport', '<span class="create-pool-review-summary__value-inline">⚽ <span>Soccer</span></span>')}
       ${row('Competition / Event', '<span class="create-pool-review-summary__value-inline">🏟️ <span>La Liga · 2026/27</span></span>')}`,
    )}
    ${section(
      'Pool Type',
      '🎯',
      `${row('Pool Type', type === 'winner' ? 'Winner Only' : 'Score Predictor')}
       ${row('Scoring Rules', scoringRows(type))}`,
    )}
    ${section(
      'Pool Details',
      '👥',
      `${row('Pool Name', 'The Extremely Long Office World Cup Prediction Pool Name That Wraps Gracefully')}
       ${row('Description', desc)}
       ${row('Visibility', '<span class="create-pool-review-summary__value-inline">🔒 <span>Private</span></span>')}`,
    )}
    ${section('Pool Experience', plan === 'custom' ? '🔥' : '✓', planRows)}
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
        <div class="flex h-full min-h-0 flex-1 flex-col">
          <div class="flex min-h-0 flex-1 flex-col">${card.replace('create-pool-review-summary--modal', 'create-pool-review-summary--modal min-h-0 flex-1')}</div>
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

  const card = page.locator('[data-testid="create-pool-review-summary"]')
  const experience = page.locator(
    '.create-pool-review-summary__heading-title',
    { hasText: 'Pool Experience' },
  )
  const scoringLabel = page.locator('.create-pool-review-summary__label', {
    hasText: 'Scoring Rules',
  })

  // Default view: card at top (sections 1–3). Then scroll to bottom for section 4.
  const fileTop = path.join(OUT, `${name}-top.png`)
  await page.screenshot({ path: fileTop, fullPage: false })

  await card.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await page.waitForTimeout(100)

  const metrics = await page.evaluate(() => {
    const modal = document.querySelector('.create-pool-wizard--modal')
    const card = document.querySelector(
      '[data-testid="create-pool-review-summary"]',
    )
    const sections = [
      ...card.querySelectorAll('.create-pool-review-summary__section'),
    ]
    const titles = sections.map(
      (s) => s.querySelector('.create-pool-review-summary__heading-title')?.textContent,
    )
    const experienceSection = sections.find((s) =>
      s.textContent.includes('Pool Experience'),
    )
    const scoringRow = [...card.querySelectorAll('.create-pool-review-summary__row')].find(
      (r) => r.textContent.includes('Scoring Rules'),
    )
    const modalRect = modal.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const expRect = experienceSection?.getBoundingClientRect()
    const stubY = parseFloat(
      getComputedStyle(modal).getPropertyValue('--stub-y') || '0',
    )
    const perforationY =
      stubY > 0 ? modalRect.top + stubY : modalRect.bottom - 96
    return {
      sectionTitles: titles,
      sectionCount: sections.length,
      cardScrollHeight: card.scrollHeight,
      cardClientHeight: card.clientHeight,
      cardScrollTop: card.scrollTop,
      cardOverflowY: getComputedStyle(card).overflowY,
      experienceVisible:
        expRect != null &&
        expRect.top >= cardRect.top &&
        expRect.bottom <= cardRect.bottom + 1,
      experienceAbovePerforation:
        expRect != null && expRect.bottom <= perforationY + 2,
      scoringHasLabel: Boolean(scoringRow?.querySelector('.create-pool-review-summary__label')),
      scoringInValueCell: Boolean(
        scoringRow?.querySelector('.create-pool-review-summary__value .create-pool-review-summary__scoring'),
      ),
      modalBg: getComputedStyle(modal).backgroundColor,
      cardBg: getComputedStyle(card).backgroundColor,
    }
  })

  const visible = await experience.isVisible()
  const labelVisible = await scoringLabel.isVisible()

  const file = path.join(OUT, `${name}-bottom.png`)
  await page.screenshot({ path: file, fullPage: false })
  await page.close()

  console.log(
    JSON.stringify({ name, fileTop, file, visible, labelVisible, metrics }, null, 2),
  )

  return {
    ...metrics,
    experienceTitleVisible: visible,
    scoringLabelVisible: labelVisible,
  }
}

const variants = [
  ['basic-classic-800', { plan: 'basic', type: 'classic', description: '' }, 800],
  ['custom-winner-800', { plan: 'custom', type: 'winner', description: 'Long desc for wrap test across the right column boundary' }, 800],
  ['basic-classic-680', { plan: 'basic', type: 'classic', description: '' }, 680],
  ['custom-classic-680', { plan: 'custom', type: 'classic', description: 'Another long description that should wrap without clipping the card edges' }, 680],
  ['null-plan-680', { plan: null, type: 'winner', description: '' }, 680],
]

const results = []
for (const [name, opts, h] of variants) {
  results.push({ name, ...(await verify(name, opts, h)) })
}

const failures = []
for (const r of results) {
  if (r.sectionCount !== 4) failures.push(`${r.name}: expected 4 sections`)
  if (!r.experienceTitleVisible) failures.push(`${r.name}: Pool Experience not visible`)
  if (!r.scoringLabelVisible) failures.push(`${r.name}: Scoring Rules label missing`)
  if (!r.scoringHasLabel) failures.push(`${r.name}: scoring row has no label`)
  if (!r.scoringInValueCell) failures.push(`${r.name}: scoring not in value cell`)
  if (!r.experienceAbovePerforation)
    failures.push(`${r.name}: Pool Experience below perforation`)
  if (r.cardOverflowY !== 'auto') failures.push(`${r.name}: card not scrollable`)
}

console.log(
  failures.length ? 'FAIL:\n' + failures.join('\n') : 'PASS — all four sections visible above perforation',
)
await browser.close()
process.exit(failures.length ? 1 : 0)
