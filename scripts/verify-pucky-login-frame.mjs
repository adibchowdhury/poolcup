/**
 * Verify Pucky login frame composition: layering, window align, click-through.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
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
      if (!top) return { tag: null }
      return {
        tag: top.tagName,
        id: top.id || null,
        text: (top.textContent || '').trim().slice(0, 40),
        inCard: Boolean(top.closest('.login-pucky-stage > .relative.z-10')),
        isPucky: Boolean(top.closest('.login-pucky-frame')),
      }
    },
    { x, y }
  )
  if (hit.isPucky) return 'blocked-by-pucky'
  if (!hit.inCard) return `miss:${hit.tag}:${hit.id || hit.text}`
  return 'ok'
}

async function probe(viewport) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport })
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(400)

  const metrics = await page.evaluate(() => {
    const stage = document.querySelector('.login-pucky-stage')
    const frame = document.querySelector('.login-pucky-frame')
    const card = stage?.querySelector(':scope > .relative.z-10')
    if (!stage || !frame || !card) {
      return { ok: false, reason: 'missing stage/frame/card' }
    }
    const sc = getComputedStyle(stage)
    const fc = getComputedStyle(frame)
    const cc = getComputedStyle(card)
    const sr = stage.getBoundingClientRect()
    const fr = frame.getBoundingClientRect()
    const cr = card.getBoundingClientRect()

    const scale = parseFloat(sc.getPropertyValue('--pucky-scale'))
    const winLeftFrac = parseFloat(sc.getPropertyValue('--pucky-window-left'))
    const winTopFrac = parseFloat(sc.getPropertyValue('--pucky-window-top'))
    const winW = parseFloat(sc.getPropertyValue('--pucky-window-width'))
    const winH = parseFloat(sc.getPropertyValue('--pucky-window-height'))

    const winLeft = fr.left + fr.width * winLeftFrac
    const winTop = fr.top + fr.height * winTopFrac
    const winWidth = fr.width * winW
    const winHeight = fr.height * winH
    const winCx = winLeft + winWidth / 2
    const winCy = winTop + winHeight / 2
    const cardCx = cr.left + cr.width / 2
    const cardCy = cr.top + cr.height / 2

    return {
      ok: true,
      frameDisplay: fc.display,
      framePointerEvents: fc.pointerEvents,
      frameZ: fc.zIndex,
      cardZ: cc.zIndex,
      scale,
      stage: { w: sr.width, h: sr.height },
      frame: { w: fr.width, h: fr.height, top: fr.top, bottom: fr.bottom },
      card: { w: cr.width, h: cr.height, top: cr.top, bottom: cr.bottom },
      align: {
        dx: +(winCx - cardCx).toFixed(1),
        dy: +(winCy - cardCy).toFixed(1),
      },
      headAbove: fr.top < cr.top - 40,
      feetBelow: fr.bottom > cr.bottom - 8,
      sidesFlank: fr.width > cr.width * 1.2,
      scaleVsCard: +(fr.width / cr.width).toFixed(3),
    }
  })

  const targets = [
    ['#email', page.locator('#email')],
    ['#password', page.locator('#password')],
    ['submit', page.locator('button[type="submit"]')],
    ['create-account', page.locator('a[href^="/create-account"]')],
    ['forgot', page.getByRole('button', { name: /forgot password/i })],
    ['google', page.getByRole('button', { name: /continue with google/i })],
  ]

  const clicks = {}
  for (const [name, loc] of targets) {
    clicks[name] = await hitTest(page, loc)
  }

  // Real focus click on email to confirm interactivity
  await page.locator('#email').click()
  clicks.emailFocus = (await page.locator('#email').evaluate((el) => document.activeElement === el))
    ? 'ok'
    : 'not-focused'

  const label = `${viewport.width}x${viewport.height}`
  const shot = resolve(outDir, `login-pucky-frame-${label}.png`)
  await page.screenshot({ path: shot, fullPage: false })

  const fit = {
    frameTop: metrics.frame?.top,
    frameBottom: metrics.frame?.bottom,
    viewportH: viewport.height,
    mohawkInView: metrics.frame ? metrics.frame.top >= -2 : false,
    feetInView: metrics.frame ? metrics.frame.bottom <= viewport.height + 4 : false,
  }

  await browser.close()
  return { viewport: label, metrics, clicks, fit, shot }
}

const results = []
for (const vp of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  results.push(await probe(vp))
}

console.log(JSON.stringify(results, null, 2))

const desktop = results[0]
const m = desktop.metrics
const pass =
  m.ok &&
  m.frameDisplay === 'block' &&
  m.framePointerEvents === 'none' &&
  Number(m.frameZ) < Number(m.cardZ) &&
  Math.abs(m.align.dx) < 4 &&
  Math.abs(m.align.dy) < 4 &&
  m.headAbove &&
  m.feetBelow &&
  m.sidesFlank &&
  desktop.fit.mohawkInView &&
  desktop.fit.feetInView &&
  Object.values(desktop.clicks).every((v) => v === 'ok')

console.log(pass ? 'PASS' : 'FAIL')
process.exit(pass ? 0 : 1)
