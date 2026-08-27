/**
 * Screenshot + metrics for static step-5 review summary.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import http from 'http'
import path from 'path'

const OUT = path.resolve('tmp/review-summary-shots')
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
console.log('css', cssHref, bundledCss.length)

function cardHtml({ plan, type, description }) {
  const scoring =
    type === 'winner'
      ? `<ul class="create-pool-review-summary__scoring">
          <li><span>✓</span><span>Winner</span><span style="font-family:monospace;color:rgba(0,230,118,.72)">+2</span></li>
          <li><span>🤝</span><span>Draw</span><span style="font-family:monospace;color:rgba(0,230,118,.72)">+3</span></li>
          <li><span>×</span><span>Miss</span><span style="font-family:monospace;color:rgba(0,230,118,.72)">+0</span></li>
        </ul>`
      : `<ul class="create-pool-review-summary__scoring">
          <li><span>🎯</span><span>Exact</span><span style="font-family:monospace;color:rgba(0,230,118,.72)">+5</span></li>
          <li><span>✓</span><span>Winner</span><span style="font-family:monospace;color:rgba(0,230,118,.72)">+2</span></li>
          <li><span>🤝</span><span>Draw</span><span style="font-family:monospace;color:rgba(0,230,118,.72)">+3</span></li>
          <li><span>×</span><span>Miss</span><span style="font-family:monospace;color:rgba(0,230,118,.72)">+0</span></li>
        </ul>`

  const planRows =
    plan === 'custom'
      ? `<div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">Plan</dt><dd class="create-pool-review-summary__value"><span class="create-pool-review-summary__value-inline">🔥 <span>Custom Pool</span></span></dd></div>
         <div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">Price</dt><dd class="create-pool-review-summary__value"><span style="color:#f2c94c">$9.99 one-time</span></dd></div>`
      : `<div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">Plan</dt><dd class="create-pool-review-summary__value">Basic Pool</dd></div>
         <div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">Price</dt><dd class="create-pool-review-summary__value">Free</dd></div>`

  const descInner = description
    ? `<span>${description}</span>`
    : `<span style="font-style:italic;font-weight:400;color:#8b98a9">No description</span>`

  return `<div class="create-pool-wizard--modal" style="background:#111111;padding:2rem;border-radius:1rem;width:48rem;max-width:calc(100% - 3rem)">
    <h1 style="text-align:center;font-size:24px;font-weight:600;margin:0 0 1.5rem;color:#f0f4f8">Review and create your pool</h1>
    <div class="create-pool-review-summary--modal mx-auto w-full overflow-hidden rounded-xl border border-[#2a2a2a]" data-testid="create-pool-review-summary">
      <section class="create-pool-review-summary__section">
        <header class="create-pool-review-summary__heading">
          <span class="create-pool-review-summary__heading-icon">🏆</span>
          <h3 class="create-pool-review-summary__heading-title">Competition</h3>
        </header>
        <dl class="create-pool-review-summary__fields">
          <div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">Sport</dt><dd class="create-pool-review-summary__value"><span class="create-pool-review-summary__value-inline">⚽ <span>Soccer</span></span></dd></div>
          <div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">Competition / Event</dt><dd class="create-pool-review-summary__value"><span class="create-pool-review-summary__value-inline">🏟️ <span>La Liga · 2026/27</span></span></dd></div>
        </dl>
      </section>
      <section class="create-pool-review-summary__section">
        <header class="create-pool-review-summary__heading">
          <span class="create-pool-review-summary__heading-icon">🎯</span>
          <h3 class="create-pool-review-summary__heading-title">Pool Type</h3>
        </header>
        <dl class="create-pool-review-summary__fields">
          <div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">Pool Type</dt><dd class="create-pool-review-summary__value">${type === 'winner' ? 'Winner Only' : 'Score Predictor'}</dd></div>
        </dl>
        ${scoring}
      </section>
      <section class="create-pool-review-summary__section">
        <header class="create-pool-review-summary__heading">
          <span class="create-pool-review-summary__heading-icon">👥</span>
          <h3 class="create-pool-review-summary__heading-title">Pool Details</h3>
        </header>
        <dl class="create-pool-review-summary__fields">
          <div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">Pool Name</dt><dd class="create-pool-review-summary__value">The Extremely Long Office World Cup Prediction Pool Name That Wraps</dd></div>
          <div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">Description</dt><dd class="create-pool-review-summary__value">${descInner}</dd></div>
          <div class="create-pool-review-summary__row"><dt class="create-pool-review-summary__label">Visibility</dt><dd class="create-pool-review-summary__value"><span class="create-pool-review-summary__value-inline">🔒 <span>Private</span></span></dd></div>
        </dl>
      </section>
      <section class="create-pool-review-summary__section">
        <header class="create-pool-review-summary__heading">
          <span class="create-pool-review-summary__heading-icon">${plan === 'custom' ? '🔥' : '✓'}</span>
          <h3 class="create-pool-review-summary__heading-title">Pool Experience</h3>
        </header>
        <dl class="create-pool-review-summary__fields">${planRows}</dl>
      </section>
    </div>
  </div>`
}

function pageHtml(opts, viewportH) {
  return `<!DOCTYPE html><html><head><style>${bundledCss}
    body{margin:0;background:#0a0a0a;font-family:Inter,system-ui,sans-serif;color:#e8edf3}
    .frame{width:1280px;height:${viewportH}px;display:flex;align-items:center;justify-content:center}
  </style></head><body><div class="frame">${cardHtml(opts)}</div></body></html>`
}

const browser = await chromium.launch({ headless: true })

async function shot(name, opts, viewportH) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: viewportH },
  })
  await page.setContent(pageHtml(opts, viewportH), { waitUntil: 'load' })
  await page.waitForTimeout(200)
  const metrics = await page.evaluate(() => {
    const card = document.querySelector(
      '[data-testid="create-pool-review-summary"]',
    )
    const modal = document.querySelector('.create-pool-wizard--modal')
    const sections = [
      ...card.querySelectorAll('.create-pool-review-summary__section'),
    ]
    const rows = [...card.querySelectorAll('.create-pool-review-summary__row')]
    const scoring = card.querySelector('.create-pool-review-summary__scoring')
    const cardCs = getComputedStyle(card)
    const modalCs = getComputedStyle(modal)
    const longValue = [
      ...card.querySelectorAll('.create-pool-review-summary__value'),
    ].find((el) => el.textContent.includes('Extremely Long'))
    return {
      cardBg: cardCs.backgroundColor,
      modalBg: modalCs.backgroundColor,
      cardWidth: Math.round(card.getBoundingClientRect().width),
      sectionCount: sections.length,
      rowCount: rows.length,
      accordionClassCount: card.querySelectorAll(
        '[class*="accordion"]',
      ).length,
      buttonCount: card.querySelectorAll('button').length,
      scoringStacked: scoring
        ? getComputedStyle(scoring).flexDirection === 'column'
        : false,
      scoringItemCount: scoring ? scoring.querySelectorAll('li').length : 0,
      longValueOverflowWrap: longValue
        ? getComputedStyle(longValue).overflowWrap
        : null,
      borders: sections.map((s) => getComputedStyle(s).borderBottomWidth),
      labelsLeft: rows.every((r) => {
        const label = r.querySelector('.create-pool-review-summary__label')
        const value = r.querySelector('.create-pool-review-summary__value')
        return (
          label.getBoundingClientRect().left <
          value.getBoundingClientRect().left
        )
      }),
      valuesRightAligned: rows.every((r) => {
        const value = r.querySelector('.create-pool-review-summary__value')
        return getComputedStyle(value).textAlign === 'right'
      }),
    }
  })
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  await page.close()
  console.log(JSON.stringify({ name, file, metrics }, null, 2))
  return metrics
}

const variants = [
  [
    'basic-classic-empty-800',
    { plan: 'basic', type: 'classic', description: '' },
    800,
  ],
  [
    'custom-winner-long-800',
    {
      plan: 'custom',
      type: 'winner',
      description:
        'Winner buys lunch for the entire office including dessert and drinks for everyone who shows up',
    },
    800,
  ],
  [
    'basic-classic-empty-680',
    { plan: 'basic', type: 'classic', description: '' },
    680,
  ],
  [
    'custom-classic-long-680',
    {
      plan: 'custom',
      type: 'classic',
      description:
        'Long description that should wrap cleanly in the right column without overflowing the card surface',
    },
    680,
  ],
]

const results = []
for (const [name, opts, h] of variants) {
  results.push(await shot(name, opts, h))
}

const failures = []
for (const m of results) {
  if (m.accordionClassCount !== 0) failures.push('accordion classes remain')
  if (m.buttonCount !== 0) failures.push('buttons remain')
  if (m.sectionCount !== 4) failures.push('expected 4 sections')
  if (!m.labelsLeft) failures.push('labels not left of values')
  if (!m.valuesRightAligned) failures.push('values not right-aligned')
  if (!m.scoringStacked) failures.push('scoring not stacked')
  if (Math.abs(m.cardWidth - 460) > 4)
    failures.push(`card width ${m.cardWidth}`)
  if (m.cardBg !== 'rgb(28, 28, 28)') failures.push(`card bg ${m.cardBg}`)
  if (m.modalBg !== 'rgb(17, 17, 17)') failures.push(`modal bg ${m.modalBg}`)
  if (
    m.longValueOverflowWrap !== 'anywhere' &&
    m.longValueOverflowWrap !== 'break-word'
  ) {
    failures.push(`wrap ${m.longValueOverflowWrap}`)
  }
}

console.log(
  failures.length ? 'FAIL: ' + [...new Set(failures)].join('; ') : 'PASS',
)
await browser.close()
process.exit(failures.length ? 1 : 0)
