/**
 * Typesetting + zero-scroll verification at 1280×800.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import http from 'http'
import path from 'path'

const OUT = path.resolve('tmp/review-summary-type')
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
  return `<ul class="create-pool-review-summary__scoring">
    ${rows
      .map(
        ([icon, label, pts]) =>
          `<li><span aria-hidden>${icon}</span><span class="create-pool-review-summary__scoring-label">${label}</span><span class="create-pool-review-summary__scoring-points">${pts}</span></li>`,
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

function ticketHtml({ plan, type }) {
  const modalH = Math.min(760, 800 * 0.9, 800 - 48)
  const planRows =
    plan === 'custom'
      ? `${row('Plan', '<span class="create-pool-review-summary__value-inline">🔥 <span>Custom Pool</span></span>')}
         ${row('Price', '<span class="create-pool-review-summary__value--gold">$9.99 one-time</span>')}`
      : `${row('Plan', 'Basic Pool')}${row('Price', 'Free')}`

  const card = `<div class="create-pool-wizard--modal create-pool-review-summary--modal mx-auto mt-0 w-full shrink-0 rounded-xl border border-[#2a2a2a]" data-testid="create-pool-review-summary">
    ${section(`${row('Sport', '<span class="create-pool-review-summary__value-inline">⚽ <span>Soccer</span></span>')}
      ${row('Competition / Event', '<span class="create-pool-review-summary__value-inline">🏟️ <span>La Liga · 2026/27</span></span>')}`)}
    ${section(`${row('Pool Type', type === 'winner' ? 'Winner Only' : 'Score Predictor')}
      ${row('Scoring Rules', scoringRows(type))}`)}
    ${section(`${row('Pool Name', 'Office World Cup Pool')}
      ${row('Description', '<span class="create-pool-review-summary__value--placeholder">No description</span>')}
      ${row('Visibility', '<span class="create-pool-review-summary__value-inline">🔒 <span>Private</span></span>')}`)}
    ${section(planRows)}
  </div>`

  return `<!DOCTYPE html><html><head><style>${bundledCss}
    body{margin:0;background:#0a0a0a;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .overlay{width:1280px;height:800px;display:flex;align-items:center;justify-content:center;padding:1.5rem;box-sizing:border-box}
  </style></head><body><div class="overlay">
    <div class="create-pool-wizard--modal create-pool-wizard--modal-ticket-shell relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#292929] bg-[#111111] p-8 shadow-2xl" style="height:${modalH}px">
      <header class="shrink-0"><div style="display:flex;justify-content:center;gap:.5rem;margin-bottom:2rem;color:#5a7080;font-size:12px">● ● ● ● ●</div>
        <h1 class="text-center font-display text-2xl tracking-wide text-foreground mt-8">Review and create your pool</h1></header>
      <div class="relative z-[2] mt-8 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden"><div class="flex h-full min-h-0 flex-1 flex-col items-center justify-start">${card}</div></div>
      <footer class="relative z-[2] flex shrink-0 flex-col justify-end pt-4"><div style="height:1px;margin-bottom:1rem;background:repeating-linear-gradient(to right,#454542 0,#454542 4px,transparent 4px,transparent 9px)"></div>
        <div style="display:flex;gap:.75rem"><button style="flex:0 0 38%;height:2.5rem;border-radius:.5rem;border:1px solid #292929;background:transparent;color:#e8edf3">Back</button>
        <button style="flex:1;height:2.5rem;border-radius:.5rem;border:none;background:#00e676;color:#0a0a0a;font-weight:600">Create pool</button></div></footer>
    </div></div></body></html>`
}

const browser = await chromium.launch({ headless: true })

async function verify(name, plan, type) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.setContent(ticketHtml({ plan, type }), { waitUntil: 'load' })
  await page.waitForTimeout(250)

  const metrics = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="create-pool-review-summary"]')
    const modal = document.querySelector('.create-pool-wizard--modal-ticket-shell')
    const labels = [...card.querySelectorAll('.create-pool-review-summary__label')]
    const values = [
      ...card.querySelectorAll(
        '.create-pool-review-summary__value:not(.create-pool-review-summary__value--placeholder):not(.create-pool-review-summary__value--gold)',
      ),
    ].filter((el) => !el.querySelector('.create-pool-review-summary__scoring'))
    const scoringLabels = [
      ...card.querySelectorAll('.create-pool-review-summary__scoring-label'),
    ]
    const scoringPoints = [
      ...card.querySelectorAll('.create-pool-review-summary__scoring-points'),
    ]
    const goldPrice = card.querySelector('.create-pool-review-summary__value--gold')
    const sections = [...card.querySelectorAll('.create-pool-review-summary__section')]
    const priceRow = [...card.querySelectorAll('.create-pool-review-summary__row')].find(
      (r) => r.textContent.includes('Price'),
    )
    const scoringRow = [...card.querySelectorAll('.create-pool-review-summary__row')].find(
      (r) => r.textContent.includes('Scoring Rules'),
    )
    const modalRect = modal.getBoundingClientRect()
    const stubY = parseFloat(getComputedStyle(modal).getPropertyValue('--stub-y') || '0')
    const perforationY = stubY > 0 ? modalRect.top + stubY : modalRect.bottom - 96

    const styleOf = (el) => {
      const cs = getComputedStyle(el)
      return {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        color: cs.color,
        lineHeight: cs.lineHeight,
      }
    }

    const labelStyles = labels.map(styleOf)
    const valueStyles = values.map((el) => styleOf(el.closest('.create-pool-review-summary__value') || el))
    const sectionPaddings = sections.map((s) => getComputedStyle(s).padding)
    const fieldsGaps = sections.map(
      (s) => getComputedStyle(s.querySelector('.create-pool-review-summary__fields')).gap,
    )

    const labelUniform = labelStyles.every(
      (s) =>
        s.fontSize === labelStyles[0].fontSize &&
        s.fontWeight === labelStyles[0].fontWeight &&
        s.color === labelStyles[0].color,
    )
    const valueUniform = valueStyles.every(
      (s) =>
        s.fontSize === valueStyles[0].fontSize &&
        s.fontWeight === valueStyles[0].fontWeight &&
        s.color === valueStyles[0].color,
    )
    const scoringLabelMatchesFieldLabel = scoringLabels.every(
      (el) =>
        styleOf(el).fontSize === labelStyles[0]?.fontSize &&
        styleOf(el).fontWeight === labelStyles[0]?.fontWeight &&
        styleOf(el).color === labelStyles[0]?.color,
    )
    const scoringPointsMatchValueSize = scoringPoints.every(
      (el) =>
        styleOf(el).fontSize === valueStyles[0]?.fontSize &&
        styleOf(el).fontWeight === valueStyles[0]?.fontWeight,
    )

    const scoringDt = scoringRow?.querySelector('.create-pool-review-summary__label')
    const scoringDd = scoringRow?.querySelector('.create-pool-review-summary__value')
    const scoringTopAligned =
      scoringDt && scoringDd
        ? Math.abs(
            scoringDt.getBoundingClientRect().top -
              scoringDd.getBoundingClientRect().top,
          ) < 2
        : false

    return {
      labelSample: labelStyles[0],
      valueSample: valueStyles[0],
      scoringLabelSample: scoringLabels[0] ? styleOf(scoringLabels[0]) : null,
      scoringPointsSample: scoringPoints[0] ? styleOf(scoringPoints[0]) : null,
      goldPriceColor: goldPrice ? getComputedStyle(goldPrice).color : null,
      labelUniform,
      valueUniform,
      scoringLabelMatchesFieldLabel,
      scoringPointsMatchValueSize,
      sectionPaddingUniform: sectionPaddings.every((p) => p === sectionPaddings[0]),
      fieldsGapUniform: fieldsGaps.every((g) => g === fieldsGaps[0]),
      sectionPadding: sectionPaddings[0],
      fieldsGap: fieldsGaps[0],
      scoringTopAligned,
      zeroScroll:
        card.scrollHeight <= card.clientHeight + 1 &&
        getComputedStyle(card).overflowY === 'visible',
      overflowBelowPerforation:
        (priceRow?.getBoundingClientRect().bottom ?? 0) - perforationY,
      cardHeight: Math.round(card.getBoundingClientRect().height),
    }
  })

  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  await page.close()
  console.log(JSON.stringify({ name, file, metrics }, null, 2))
  return metrics
}

const results = [
  await verify('basic-classic-800', 'basic', 'classic'),
  await verify('custom-winner-800', 'custom', 'winner'),
]

const ok = results.every(
  (m) =>
    m.labelUniform &&
    m.valueUniform &&
    m.scoringLabelMatchesFieldLabel &&
    m.scoringPointsMatchValueSize &&
    m.sectionPaddingUniform &&
    m.fieldsGapUniform &&
    m.scoringTopAligned &&
    m.zeroScroll &&
    m.overflowBelowPerforation <= 0,
)

console.log(ok ? 'PASS' : 'FAIL')
await browser.close()
process.exit(ok ? 0 : 1)
