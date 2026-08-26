/**
 * Verify step-2 mode cards at 1280×800 and 390×844.
 */
import { chromium } from 'playwright'

const cardCss = `
.card {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 0.75rem;
  padding: 1.25rem;
  border: 1px solid #1e2d3d;
  background: transparent;
  color: #5a7080;
  text-align: left;
}
.card:hover { background: rgba(255,255,255,0.03); color: #f0f4f8; }
.card[aria-pressed="true"] {
  border: 2px solid #00e676;
  box-shadow: 0 0 0 2px rgba(0,230,118,0.4);
  color: #f0f4f8;
}
.icon { width: 48px; height: 48px; margin-bottom: 1rem; color: #00e676; }
.badge {
  position: absolute; top: 12px; right: 12px;
  border: 1px solid rgba(0,230,118,0.35);
  background: rgba(0,230,118,0.1);
  color: #00e676;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.title { font-size: 16px; font-weight: 600; color: #f0f4f8; }
.primary { margin-top: 8px; font-size: 14px; font-weight: 500; color: rgba(240,244,248,0.9); }
.secondary { margin-top: 6px; font-size: 12px; color: #5a7080; }
`

function pageHtml(widthClass) {
  return `<!DOCTYPE html><html><head><style>
  *{box-sizing:border-box} body{margin:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#f0f4f8}
  .modal{width:${widthClass};margin:24px auto;padding:2rem;border:2px solid #292929;border-radius:1rem;background:#111;min-height:420px}
  h1{margin:0 0 1.5rem;font-size:1.5rem;text-align:center}
  .row{display:flex;flex-direction:column;gap:12px}
  @media(min-width:1024px){.row{flex-direction:row;align-items:stretch;gap:16px}}
  ${cardCss}
  </style></head><body>
  <div class="modal">
    <h1>How do you want to play?</h1>
    <div class="row">
      <button class="card" aria-pressed="true" type="button">
        <span class="badge">Most popular</span>
        <svg class="icon" viewBox="0 0 48 48" fill="none"><rect x="5" y="10" width="38" height="28" rx="5" stroke="currentColor" stroke-width="2"/><path d="M24 10v28" stroke="currentColor" stroke-width="2"/></svg>
        <span class="title">Score Predictor</span>
        <span class="primary">Predict the exact score</span>
        <span class="secondary">More competitive · More ways to earn points</span>
      </button>
      <button class="card" aria-pressed="false" type="button">
        <svg class="icon" viewBox="0 0 48 48" fill="none" style="color:#5a7080"><path d="M16 12h16v8a8 8 0 0 1-16 0v-8Z" stroke="currentColor" stroke-width="2"/></svg>
        <span class="title">Winner Only</span>
        <span class="primary">Just pick the winner</span>
        <span class="secondary">Faster picks · Great for casual groups</span>
      </button>
    </div>
  </div>
  </body></html>`
}

async function measure(viewport) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport })
  const modalWidth =
    viewport.width >= 1024
      ? 'min(48rem, calc(100vw - 3rem))'
      : 'calc(100vw - 1.5rem)'
  await page.setContent(pageHtml(modalWidth), { waitUntil: 'load' })
  const report = await page.evaluate((vp) => {
    const cards = Array.from(document.querySelectorAll('.card'))
    const row = document.querySelector('.row')
    const cs = getComputedStyle(row)
    return {
      viewport: vp,
      direction: cs.flexDirection,
      cards: cards.map((card) => {
        const r = card.getBoundingClientRect()
        const st = getComputedStyle(card)
        return {
          title: card.querySelector('.title')?.textContent,
          primary: card.querySelector('.primary')?.textContent,
          secondary: card.querySelector('.secondary')?.textContent,
          hasBadge: Boolean(card.querySelector('.badge')),
          pressed: card.getAttribute('aria-pressed'),
          background: st.backgroundColor,
          width: Math.round(r.width),
          height: Math.round(r.height),
        }
      }),
      helperPresent: /Score Predictor or Winner Only/i.test(
        document.body.textContent || '',
      ),
    }
  }, viewport)
  await browser.close()
  return report
}

const desktop = await measure({ width: 1280, height: 800 })
const mobile = await measure({ width: 390, height: 844 })
console.log(JSON.stringify({ desktop, mobile }, null, 2))
