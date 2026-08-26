/**
 * Measure step-2 themed mode cards at 1280×800 and 390×844.
 */
import { chromium } from 'playwright'

const html = `<!DOCTYPE html><html><head><style>
*{box-sizing:border-box}
body{margin:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#f0f4f8}
.modal{width:min(48rem,calc(100vw - 3rem));height:min(90vh,720px);margin:24px auto;padding:2rem;border:2px solid #292929;border-radius:1rem;background:#111;display:flex;flex-direction:column}
.header{flex-shrink:0;text-align:center;margin-bottom:2rem}
.header h1{margin:0;font-size:1.5rem}
.body{flex:1 1 0;min-height:0;display:flex}
.row{display:flex;flex:1;flex-direction:column;gap:12px;width:100%}
@media(min-width:1024px){.row{flex-direction:row;gap:16px}}
.card{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:14rem;border-radius:0.75rem;padding:1.5rem 1.25rem;text-align:center;transition:background-color .16s,border-color .16s}
@media(min-width:1024px){.card{min-height:20rem}}
.classic{border:1px solid rgba(124,58,237,.45);background:rgba(124,58,237,.10)}
.classic:hover{border-color:rgba(124,58,237,.60);background:rgba(124,58,237,.16)}
.classic[aria-pressed="true"]{border:2px solid #00e676;background:rgba(124,58,237,.12);box-shadow:0 0 0 2px rgba(0,230,118,.45),0 0 0 4px #111}
.winner{border:1px solid rgba(255,179,0,.45);background:rgba(255,179,0,.10)}
.winner:hover{border-color:rgba(255,179,0,.60);background:rgba(255,179,0,.16)}
.winner[aria-pressed="true"]{border:2px solid #00e676;background:rgba(255,179,0,.12);box-shadow:0 0 0 2px rgba(0,230,118,.45),0 0 0 4px #111}
.pucky{width:72px;height:72px;margin-bottom:1rem;background:#333;border-radius:12px}
@media(min-width:1024px){.pucky{width:96px;height:96px;margin-bottom:1.25rem}}
.title{font-size:1.5rem;font-weight:600}
.classic .title{color:#c4b5fd}
.winner .title{color:#ffc933}
.classic[aria-pressed="true"] .title,.winner[aria-pressed="true"] .title{color:#00e676}
.primary{margin-top:10px;font-size:1.3125rem;font-weight:500;color:rgba(240,244,248,.92)}
.secondary{margin-top:8px;font-size:1.125rem;line-height:1.3;color:#a8b8c4;max-width:18rem}
.badge{position:absolute;top:12px;right:12px;border:1px solid rgba(124,58,237,.4);background:rgba(124,58,237,.15);color:#c4b5fd;border-radius:999px;padding:2px 10px;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
.footer{flex-shrink:0;height:3.25rem;margin-top:1rem;background:rgba(255,255,255,.04);border-radius:8px}
</style></head><body>
<div class="modal">
  <div class="header"><h1>How do you want to play?</h1></div>
  <div class="body"><div class="row">
    <button class="card classic" aria-pressed="true" type="button">
      <span class="badge">Most popular</span>
      <div class="pucky"></div>
      <span class="title">Score Predictor</span>
      <span class="primary">Predict the exact score</span>
      <span class="secondary">More competitive · More ways to earn points</span>
    </button>
    <button class="card winner" aria-pressed="false" type="button">
      <div class="pucky"></div>
      <span class="title">Winner Only</span>
      <span class="primary">Just pick the winner</span>
      <span class="secondary">Faster picks · Great for casual groups</span>
    </button>
  </div></div>
  <div class="footer"></div>
</div>
</body></html>`

async function measure(viewport) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport })
  await page.setContent(html, { waitUntil: 'load' })
  const report = await page.evaluate((vp) => {
    const cards = Array.from(document.querySelectorAll('.card'))
    const row = document.querySelector('.row')
    return {
      viewport: vp,
      direction: getComputedStyle(row).flexDirection,
      bodyHeight: document.querySelector('.body').clientHeight,
      cards: cards.map((card) => {
        const r = card.getBoundingClientRect()
        const st = getComputedStyle(card)
        const secondary = card.querySelector('.secondary')
        const secR = secondary.getBoundingClientRect()
        const title = card.querySelector('.title')
        const primary = card.querySelector('.primary')
        const pucky = card.querySelector('.pucky')
        return {
          theme: card.classList.contains('classic') ? 'purple' : 'gold',
          pressed: card.getAttribute('aria-pressed'),
          width: Math.round(r.width),
          height: Math.round(r.height),
          borderColor: st.borderColor,
          background: st.backgroundColor,
          puckyPx: Math.round(pucky.getBoundingClientRect().width),
          titlePx: parseFloat(getComputedStyle(title).fontSize),
          primaryPx: parseFloat(getComputedStyle(primary).fontSize),
          secondaryPx: parseFloat(getComputedStyle(secondary).fontSize),
          secondaryLines: Math.round(secR.height / parseFloat(getComputedStyle(secondary).lineHeight)),
          secondaryText: secondary.textContent,
        }
      }),
    }
  }, viewport)
  await browser.close()
  return report
}

const desktop = await measure({ width: 1280, height: 800 })
const mobile = await measure({ width: 390, height: 844 })
console.log(JSON.stringify({ desktop, mobile }, null, 2))
