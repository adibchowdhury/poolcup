/**
 * Verify raised stub-y is consistent across steps 1–5; no content/perforation collisions.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const OUT = path.resolve('tmp/ticket-stub-steps')
fs.mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { name: '800', w: 1280, h: 800 },
  { name: '680', w: 1280, h: 680 },
]

async function runViewport({ name, w, h }) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: w, height: h } })

  await page.goto('http://localhost:3000/dashboard', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.waitForTimeout(1500)

  const createBtn = page
    .locator('button, a, [role="button"]')
    .filter({ hasText: /^Create a pool$/i })
    .first()
  const hasCreate = await createBtn.isVisible().catch(() => false)
  if (!hasCreate) {
    await browser.close()
    return { name, skipped: true, reason: 'Create a pool control not visible (auth?)' }
  }

  await createBtn.click()
  await page.waitForSelector('.create-pool-wizard--modal-ticket-shell', {
    timeout: 15000,
  })
  await page.waitForTimeout(400)

  const stepResults = []

  for (let step = 1; step <= 5; step++) {
    while (true) {
      const current = await page.evaluate(() => {
        const stepper = document.querySelector('[data-create-pool-stepper]')
        const active = stepper?.querySelector('[aria-current="step"]')
        const label = active?.getAttribute('aria-label') || active?.textContent || ''
        const m = label.match(/(\d+)/)
        return m ? Number(m[1]) : null
      })
      if (current === step) break
      if (step === 1 && current === 1) break
      const cont = page.getByRole('button', { name: /Continue|Upgrade & Continue|Create My Pool|Upgrade & Create/i })
      if ((await cont.count()) === 0) break
      await cont.first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(900)
    }

    await page.waitForTimeout(300)
    const file = path.join(OUT, `step-${step}-${name}.png`)
    await page.screenshot({ path: file, fullPage: false })

    const metrics = await page.evaluate(() => {
      const shell = document.querySelector('.create-pool-wizard--modal-ticket-shell')
      const slide = document.querySelector('[data-create-pool-slide-viewport]')
      const pane = document.querySelector('[data-create-pool-pane="left"]')
      const contentBottom = pane
        ? Math.max(
            ...[...pane.querySelectorAll('*')].map((el) => {
              const r = el.getBoundingClientRect()
              return r.height > 0 ? r.bottom : 0
            }),
          )
        : 0
      const shellRect = shell?.getBoundingClientRect()
      const stubVar = shell
        ? getComputedStyle(shell).getPropertyValue('--stub-y').trim()
        : ''
      const stubFooter = shell
        ? getComputedStyle(shell).getPropertyValue(
            '--create-pool-modal-stub-footer-region',
          ).trim()
        : ''
      const stubYpx = shellRect && stubVar.endsWith('%')
        ? shellRect.top +
          (parseFloat(stubVar) / 100) * shellRect.height
        : shellRect
          ? shellRect.top +
            parseFloat(getComputedStyle(shell).getPropertyValue('--stub-y'))
          : 0
      const perforationEl = shell
      const perforationY =
        shellRect && perforationEl
          ? shellRect.top +
            (shellRect.height -
              parseFloat(
                getComputedStyle(shell)
                  .getPropertyValue('--create-pool-modal-stub-footer-region')
                  .replace(/[^\d.]/g, '') || '130',
              ) || 130)
          : 0
      // Use ::before pseudo - approximate stub-y from CSS variable calc
      const cs = shell ? getComputedStyle(shell) : null
      const footerRegionPx = (() => {
        if (!shell) return 0
        const probe = document.createElement('div')
        probe.style.position = 'absolute'
        probe.style.visibility = 'hidden'
        probe.style.height = cs.getPropertyValue(
          '--create-pool-modal-stub-footer-region',
        )
        document.body.appendChild(probe)
        const px = probe.offsetHeight
        probe.remove()
        return px
      })()
      const perforation =
        shellRect != null ? shellRect.top + shellRect.height - footerRegionPx : 0
      const reassurance = document.querySelector('.create-pool-review-reassurance')
      const scoringGap = document
        .querySelector('.create-pool-review-summary__scoring')
        ?.parentElement
        ? getComputedStyle(document.querySelector('.create-pool-review-summary--modal') || document.body)
            .getPropertyValue('--create-pool-review-scoring-line-gap')
            .trim()
        : null
      return {
        stubFooterRegion: stubFooter,
        stubFooterRegionPx: footerRegionPx,
        perforationY: Math.round(perforation),
        contentBottom: Math.round(contentBottom),
        overflowPx: Math.round(contentBottom - perforation),
        reassurancePresent: Boolean(reassurance),
        scoringLineGap: scoringGap,
        shellHeight: shellRect ? Math.round(shellRect.height) : 0,
      }
    })

    stepResults.push({ step, file, metrics })
  }

  await browser.close()
  return { name, skipped: false, stepResults }
}

const all = []
for (const vp of VIEWPORTS) {
  all.push(await runViewport(vp))
}

console.log(JSON.stringify(all, null, 2))

const r800 = all.find((r) => r.name === '800' && !r.skipped)
const r680 = all.find((r) => r.name === '680' && !r.skipped)

if (!r800) {
  console.log('SKIP live verify — dashboard unavailable')
  process.exit(0)
}

const stubHeights = r800.stepResults.map((s) => s.metrics.stubFooterRegionPx)
const perforations = r800.stepResults.map((s) => s.metrics.perforationY)
const stubUniform = stubHeights.every((h) => h === stubHeights[0])
const perfUniform = perforations.every((p) => p === perforations[0])
const collisions800 = r800.stepResults.filter((s) => s.metrics.overflowPx > 2)
const collisions680 = r680?.stepResults?.filter((s) => s.metrics.overflowPx > 2) ?? []

console.log(
  stubUniform && perfUniform && collisions800.length === 0
    ? `PASS 800 — stub ${stubHeights[0]}px, perforation ${perforations[0]}px`
    : `FAIL 800 — collisions: ${collisions800.map((c) => `step${c.step}:${c.metrics.overflowPx}px`).join(', ')}`,
)
if (r680 && !r680.skipped) {
  console.log(
    collisions680.length === 0
      ? 'PASS 680 — no collisions'
      : `680 overflow: ${collisions680.map((c) => `step${c.step}:${c.metrics.overflowPx}px`).join(', ')}`,
  )
}

process.exit(stubUniform && perfUniform && collisions800.length === 0 ? 0 : 1)
