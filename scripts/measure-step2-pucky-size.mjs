import { chromium } from 'playwright'

const html = `<!DOCTYPE html><html><head><style>
*{box-sizing:border-box}
body{margin:0;background:#0a0a0a}
.overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:1.5rem}
.modal{width:min(48rem,calc(100vw - 3rem));height:min(760px,90vh,calc(100dvh - 3rem));display:flex;flex-direction:column;overflow:hidden;border:2px solid #292929;border-radius:1rem;background:#111;padding:2rem;color:#f0f4f8;font-family:system-ui,sans-serif}
.header{flex-shrink:0;height:5.5rem;margin-bottom:1.25rem;background:rgba(255,255,255,.04);border-radius:8px}
.body{flex:1 1 0;min-height:0;overflow:hidden;display:flex;gap:20px}
.left{width:42%;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.pucky{height:clamp(13.75rem,36vh,16rem);width:clamp(13.75rem,36vh,16rem);background:#222;border-radius:12px}
.right{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;overflow:auto}
.block{}.field{height:3.25rem;margin-bottom:1.25rem;background:#171717;border-radius:.75rem}
.seg{display:flex;border:1px solid #292929;background:#171717;border-radius:.75rem;padding:4px;margin-bottom:12px}
.seg button{flex:1;padding:10px;border-radius:.5rem;border:0;background:transparent;color:#5a7080;font-weight:600}
.seg button.on{background:#00e676;color:#041}
.lines{font-size:12px}.lines .on{color:rgba(240,244,248,.9)}.lines .off{color:rgba(90,112,128,.7)}
.footer{flex-shrink:0;height:3.5rem;margin-top:1rem;background:rgba(255,255,255,.06);border-radius:8px}
</style></head><body>
<div class="overlay"><div class="modal" id="modal">
  <div class="header"></div>
  <div class="body">
    <aside class="left" id="left"><div class="pucky" id="pucky"></div><h2 style="margin-top:20px">Set up your pool</h2></aside>
    <div class="right" id="right"><div class="block" id="block">
      <div class="field"></div><div class="field" style="height:4.5rem"></div>
      <div class="seg"><button class="on">Private</button><button>Public</button></div>
      <div class="lines"><div class="on">Private — invite</div><div class="off">Public — discover</div></div>
    </div></div>
  </div>
  <div class="footer" id="footer"></div>
</div></div>
</body></html>`

const browser = await chromium.launch({ headless: true })
const results = {}
for (const vp of [
  { width: 1280, height: 800 },
  { width: 1280, height: 680 },
]) {
  const page = await browser.newPage({ viewport: vp })
  await page.setContent(html, { waitUntil: 'load' })
  results[`${vp.width}x${vp.height}`] = await page.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect()
    const left = r('left')
    const block = r('block')
    const right = r('right')
    const pucky = r('pucky')
    const footer = r('footer')
    const rightMid = right.top + right.height / 2
    const blockMid = block.top + block.height / 2
    return {
      puckyPx: Math.round(pucky.height),
      leftFullyVisible: left.bottom <= footer.top + 1,
      rightBlockCenteredPx: Math.round(Math.abs(rightMid - blockMid)),
    }
  })
  await page.close()
}
console.log(JSON.stringify(results, null, 2))
await browser.close()
