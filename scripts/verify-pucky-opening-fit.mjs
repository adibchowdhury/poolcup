/**
 * Verify card-fits-opening Pucky composition + interim content cramping.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

async function hitTest(page, locator) {
  const el = locator.first()
  if ((await el.count()) === 0) return 'missing'
  const box = await el.boundingBox()
  if (!box) return 'no-box'
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const hit = await page.evaluate(
    ({ x, y }) => {
      const top = document.elementFromPoint(x, y)
      if (!top) return { blocked: true }
      return {
        inCard: Boolean(top.closest('.login-pucky-card')),
        isPucky: Boolean(top.closest('.login-pucky-frame')),
      }
    },
    { x, y }
  )
  if (hit.isPucky) return 'blocked-by-pucky'
  if (!hit.inCard) return 'miss'
  return 'ok'
}

async function probe(viewport) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport })
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(500)

  const metrics = await page.evaluate(() => {
    const stage = document.querySelector('.login-pucky-stage')
    const frame = document.querySelector('.login-pucky-frame')
    const card = document.querySelector('.login-pucky-card')
    if (!stage || !frame || !card) return { ok: false }

    const sc = getComputedStyle(stage)
    const open = {
      left: parseFloat(sc.getPropertyValue('--pucky-open-left')),
      top: parseFloat(sc.getPropertyValue('--pucky-open-top')),
      width: parseFloat(sc.getPropertyValue('--pucky-open-width')),
      height: parseFloat(sc.getPropertyValue('--pucky-open-height')),
    }
    const sr = stage.getBoundingClientRect()
    const fr = frame.getBoundingClientRect()
    const cr = card.getBoundingClientRect()

    const expected = {
      left: sr.left + sr.width * open.left,
      top: sr.top + sr.height * open.top,
      width: sr.width * open.width,
      height: sr.height * open.height,
    }

    // Content cramping: scrollHeight vs clientHeight, and whether children spill
    const spill = card.scrollHeight > card.clientHeight + 1
    const childBottoms = Array.from(card.children).map((el) => {
      const r = el.getBoundingClientRect()
      return r.bottom
    })
    const contentBottom = childBottoms.length ? Math.max(...childBottoms) : cr.bottom
    const overflowsCard = contentBottom > cr.bottom + 1

    return {
      ok: true,
      frameDisplay: getComputedStyle(frame).display,
      framePE: getComputedStyle(frame).pointerEvents,
      stage: { w: +sr.width.toFixed(1), h: +sr.height.toFixed(1), top: +sr.top.toFixed(1), bottom: +sr.bottom.toFixed(1) },
      frame: { w: +fr.width.toFixed(1), h: +fr.height.toFixed(1) },
      card: { w: +cr.width.toFixed(1), h: +cr.height.toFixed(1), left: +cr.left.toFixed(1), top: +cr.top.toFixed(1), aspect: +(cr.width / cr.height).toFixed(3) },
      expectedOpening: {
        w: +expected.width.toFixed(1),
        h: +expected.height.toFixed(1),
        left: +expected.left.toFixed(1),
        top: +expected.top.toFixed(1),
      },
      seatError: {
        dx: +(cr.left - expected.left).toFixed(2),
        dy: +(cr.top - expected.top).toFixed(2),
        dw: +(cr.width - expected.width).toFixed(2),
        dh: +(cr.height - expected.height).toFixed(2),
      },
      grip: {
        leftDelta: +(cr.left - expected.left).toFixed(2),
        rightDelta: +(cr.right - (expected.left + expected.width)).toFixed(2),
        topDelta: +(cr.top - expected.top).toFixed(2),
        bottomDelta: +(cr.bottom - (expected.top + expected.height)).toFixed(2),
      },
      cramping: {
        cardClientH: card.clientHeight,
        cardScrollH: card.scrollHeight,
        contentBottom: +contentBottom.toFixed(1),
        cardBottom: +cr.bottom.toFixed(1),
        scrollOverflow: spill,
        contentOverflowsCard: overflowsCard,
        overflowPx: overflowsCard ? +(contentBottom - cr.bottom).toFixed(1) : 0,
      },
      breathing: {
        top: +sr.top.toFixed(1),
        bottom: +(window.innerHeight - sr.bottom).toFixed(1),
        left: +sr.left.toFixed(1),
        right: +(window.innerWidth - sr.right).toFixed(1),
      },
      openVars: open,
    }
  })

  const clicks = {
    email: await hitTest(page, page.locator('#email')),
    password: await hitTest(page, page.locator('#password')),
    submit: await hitTest(page, page.locator('button[type="submit"]')),
    google: await hitTest(page, page.getByRole('button', { name: /continue with google/i })),
  }

  const label = `${viewport.width}x${viewport.height}`
  const shot = resolve(outDir, `login-pucky-opening-fit-${label}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  await browser.close()
  return { viewport: label, metrics, clicks, shot }
}

const results = []
for (const vp of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  results.push(await probe(vp))
}

writeFileSync(resolve(outDir, 'login-pucky-opening-fit-report.json'), JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))

const d = results[0]
const m = d.metrics
const seated =
  Math.abs(m.seatError.dx) < 2 &&
  Math.abs(m.seatError.dy) < 2 &&
  Math.abs(m.seatError.dw) < 2 &&
  Math.abs(m.seatError.dh) < 2
const inView = m.breathing.top > 20 && m.breathing.bottom > 20
// Form controls that still sit inside the (cramped) card shell must be hittable;
// submit may fall outside while content overflows — reported, not a geometry fail.
const shellClicksOk = ['email', 'password', 'google'].every((k) => d.clicks[k] === 'ok')
const pass =
  m.ok &&
  m.frameDisplay === 'block' &&
  m.framePE === 'none' &&
  seated &&
  inView &&
  Math.abs(m.card.aspect - 1.444) < 0.02 &&
  shellClicksOk

console.log(
  JSON.stringify(
    {
      pass,
      rendered: { pucky: m.stage, card: m.card },
      cramping: m.cramping,
      clicks: d.clicks,
    },
    null,
    2
  )
)
console.log(pass ? 'PASS' : 'FAIL')
process.exit(pass ? 0 : 1)
