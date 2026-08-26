/**
 * Measure create-wizard modal step-1 card grid at 1280×800.
 * Usage: node scripts/measure-modal-cards.mjs
 */
import { chromium } from 'playwright'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const css = readFileSync(
  resolve(process.cwd(), 'components/create/create-competition-step.css'),
  'utf8',
)
const liveDotCss = `
@keyframes stage-live-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.35); }
  50% { opacity: 0.55; box-shadow: 0 0 8px 2px rgba(239, 68, 68, 0.5); }
}
.stage-live-dot-light {
  background-color: #ffffff;
  animation: stage-live-pulse 1.75s ease-in-out infinite;
}
:root { --dashboard-card-bg: #171717; }
`

const competitions = [
  { name: 'Premier League 2026/27', inSeason: true },
  { name: 'La Liga 2026/27', inSeason: true },
  { name: 'Serie A 2026/27', inSeason: false },
  { name: 'Bundesliga 2026/27', inSeason: false },
  { name: 'Ligue 1 2026/27', inSeason: false },
  { name: 'MLS 2026', inSeason: false },
]

const cards = competitions
  .map(
    (c, i) => `
  <button type="button" class="create-competition-step__row" aria-pressed="${i === 0}">
    <span class="create-competition-step__status create-competition-step__status--badge ${c.inSeason ? 'create-competition-step__status--in-season' : ''}">
      ${c.inSeason ? '<span class="stage-live-dot-light h-1.5 w-1.5 shrink-0 rounded-full"></span>' : '<span class="create-competition-step__dot"></span>'}${c.inSeason ? 'In season' : 'Upcoming'}
    </span>
    <div class="create-competition-step__card-body">
      <div class="create-competition-step__title-row">
        <span class="create-competition-step__crest">
          <img class="create-competition-step__crest-img create-competition-step__crest-img--league" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Crect fill='%23333' width='28' height='28' rx='4'/%3E%3C/svg%3E" width="28" height="28" alt="" />
        </span>
        <span class="create-competition-step__name">${c.name}</span>
      </div>
    </div>
  </button>`,
  )
  .join('')

const sports = ['Soccer', 'Basketball', 'Baseball', 'Football', 'Hockey']
  .map(
    (label, i) => `
  <button type="button" class="create-competition-step__sport" aria-selected="${i === 0}">
    <span class="create-competition-step__sport-ball" style="width:48px;height:48px;background:#444;border-radius:50%;display:block"></span>
    <span class="create-competition-step__sport-label">${label}</span>
  </button>`,
  )
  .join('')

const html = `<!DOCTYPE html><html><head><style>
:root { --primary: #00e676; --primary-foreground: #04120a; }
* { box-sizing: border-box; }
body { margin:0; background:#0a0a0a; font-family: system-ui,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
.modal-card { width: min(48rem, calc(100vw - 3rem)); height: min(90vh, 720px); padding: 2rem; border:2px solid #292929; border-radius:1rem; background:#111; color:#f0f4f8; display:flex; flex-direction:column; overflow:hidden; }
.modal-header { flex-shrink:0; text-align:center; }
.modal-header h1 { margin:0; font-size:1.5rem; font-weight:600; }
.stepper { height:2.75rem; margin-top:2rem; background:rgba(255,255,255,0.06); border-radius:8px; }
.slide-pane { margin-top:2rem; flex:1 1 0; min-height:0; overflow-x:hidden; overflow-y:auto; padding:0 0.375rem; }
.footer { flex-shrink:0; padding-top:1rem; height:3.25rem; background:rgba(255,255,255,0.04); border-radius:8px; }
${liveDotCss}
${css}
</style></head><body>
<div class="modal-card" id="card">
  <div class="modal-header"><h1>Choose a competition</h1><div class="stepper"></div></div>
  <div class="slide-pane" id="pane">
    <div class="create-competition-step create-competition-step--modal">
      <div class="create-competition-step__layout">
        <div class="create-competition-step__rail-col"><div class="create-competition-step__rail">${sports}</div></div>
        <div class="create-competition-step__panel"><div class="create-competition-step__list" id="list">${cards}</div></div>
      </div>
    </div>
  </div>
  <div class="footer"></div>
</div></body></html>`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.setContent(html, { waitUntil: 'load' })
await page.waitForTimeout(100)

const report = await page.evaluate(() => {
  const pane = document.getElementById('pane')
  const list = document.getElementById('list')
  const rows = Array.from(document.querySelectorAll('.create-competition-step__row'))
  const card = document.getElementById('card')
  const layout = document.querySelector('.create-competition-step__layout')
  const rail = document.querySelector('.create-competition-step__rail')
  const sports = Array.from(document.querySelectorAll('.create-competition-step__sport'))
  const railBox = rail.getBoundingClientRect()
  const listBox = list.getBoundingClientRect()
  const modalInner = document.querySelector('.slide-pane')
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    layoutRowGap: getComputedStyle(layout).rowGap,
    sportToGridGapPx: Math.round(listBox.top - railBox.bottom),
    sportRailWidth: Math.round(railBox.width),
    modalBodyWidth: modalInner.clientWidth,
    sportChipsFit: Math.round(railBox.width) <= modalInner.clientWidth + 1,
    sportChipWidths: sports.map((s) => Math.round(s.getBoundingClientRect().width)),
    sportBallSize: getComputedStyle(document.querySelector('.create-competition-step__sport-ball')).width,
    sportLabelSize: getComputedStyle(document.querySelector('.create-competition-step__sport-label')).fontSize,
    selectedHasUnderline: Boolean(
      getComputedStyle(document.querySelector('.create-competition-step__sport[aria-selected="true"]'), '::before').content !== 'none' &&
      getComputedStyle(document.querySelector('.create-competition-step__sport[aria-selected="true"]'), '::before').height !== '0px'
    ),
    cardHeight: Math.round(card.getBoundingClientRect().height),
    paneClientHeight: pane.clientHeight,
    paneScrollHeight: pane.scrollHeight,
    paneScrollNeeded: pane.scrollHeight > pane.clientHeight + 1,
    paneOverflowPx: pane.scrollHeight - pane.clientHeight,
    listHeight: Math.round(list.getBoundingClientRect().height),
    rowHeights: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
    rowNames: rows.map((r) => {
      const name = r.querySelector('.create-competition-step__name')
      const cs = getComputedStyle(name)
      return {
        text: name.textContent,
        lines: Math.round(name.getBoundingClientRect().height / parseFloat(cs.lineHeight)),
        whiteSpace: cs.whiteSpace,
      }
    }),
    gridCols: getComputedStyle(list).gridTemplateColumns,
    inSeasonPill: (() => {
      const pill = document.querySelector('.create-competition-step__status--in-season')
      if (!pill) return null
      const cs = getComputedStyle(pill)
      const dot = pill.querySelector('.stage-live-dot-light')
      const dotCs = dot ? getComputedStyle(dot) : null
      return {
        fontSize: cs.fontSize,
        color: cs.color,
        backgroundImage: cs.backgroundImage,
        dotBg: dotCs?.backgroundColor,
        dotAnimation: dotCs?.animationName,
        cardSurface: getComputedStyle(document.querySelector('.create-competition-step__row')).backgroundColor,
      }
    })(),
  }
})

console.log(JSON.stringify(report, null, 2))
await browser.close()
