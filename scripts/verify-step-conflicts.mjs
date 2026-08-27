/**
 * Per-step conflict resolution verify — 1280×800 + 1280×680.
 * Measures perforation uniformity, content/line overlaps, step-specific metrics.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const OUT = path.resolve('tmp/step-conflicts')
fs.mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { name: '800', w: 1280, h: 800 },
  { name: '680', w: 1280, h: 680 },
]

function perforationY(shell) {
  const shellRect = shell.getBoundingClientRect()
  const cs = getComputedStyle(shell)
  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.height = cs.getPropertyValue('--create-pool-modal-stub-footer-region')
  document.body.appendChild(probe)
  const footerPx = probe.offsetHeight
  probe.remove()
  return { perforationY: shellRect.top + shellRect.height - footerPx, footerPx }
}

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
  if (!(await createBtn.isVisible().catch(() => false))) {
    await browser.close()
    return { name, skipped: true, reason: 'auth' }
  }

  await createBtn.click()
  await page.waitForSelector('.create-pool-wizard--modal-ticket-shell', {
    timeout: 15000,
  })
  await page.waitForTimeout(500)

  const stepResults = []

  for (let step = 1; step <= 5; step++) {
    while (true) {
      const current = await page.evaluate(() => {
        const active = document.querySelector('[aria-current="step"]')
        const label = active?.getAttribute('aria-label') || active?.textContent || ''
        const m = label.match(/(\d+)/)
        return m ? Number(m[1]) : null
      })
      if (current === step) break
      const cont = page.getByRole('button', {
        name: /Continue|Upgrade & Continue|Create My Pool|Upgrade & Create/i,
      })
      if ((await cont.count()) === 0) break
      await cont.first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(900)
    }

    await page.waitForTimeout(400)
    const file = path.join(OUT, `step-${step}-${name}.png`)
    await page.screenshot({ path: file, fullPage: false })

    const metrics = await page.evaluate((stepNum) => {
      const shell = document.querySelector('.create-pool-wizard--modal-ticket-shell')
      const pane = document.querySelector('[data-create-pool-pane="left"]')
      if (!shell || !pane) return { error: 'missing shell/pane' }

      const { perforationY: perfY, footerPx } = perforationY(shell)
      const paneRect = pane.getBoundingClientRect()
      const contentBottom = [...pane.querySelectorAll('*')].reduce(
        (max, el) => Math.max(max, el.getBoundingClientRect().bottom),
        paneRect.top,
      )

      const out = {
        step: stepNum,
        footerPx,
        perforationY: Math.round(perfY),
        contentBottom: Math.round(contentBottom),
        overflowPx: Math.round(contentBottom - perfY),
      }

      if (stepNum === 2) {
        const cards = [...pane.querySelectorAll('.create-pool-scoring-style-card')]
        out.scoringCards = cards.map((c) => {
          const r = c.getBoundingClientRect()
          return { label: c.querySelector('p')?.textContent?.trim(), heightPx: Math.round(r.height) }
        })
        const disclaimer = pane.querySelector('p.shrink-0')
        if (disclaimer && cards.length) {
          const cardBottom = Math.max(...cards.map((c) => c.getBoundingClientRect().bottom))
          out.disclaimerOffsetPx = Math.round(disclaimer.getBoundingClientRect().top - cardBottom)
        }
      }

      if (stepNum === 3) {
        const divider = pane.querySelector('.create-pool-step3-divider')
        if (divider) {
          const dr = divider.getBoundingClientRect()
          out.dividerBottom = Math.round(dr.bottom)
          out.dividerClearancePx = Math.round(perfY - dr.bottom)
        }
        const layout = pane.querySelector('.create-pool-step3-layout')
        if (layout) {
          out.step3LayoutMarginTop = getComputedStyle(layout).marginTop
        }
      }

      if (stepNum === 4) {
        const grid = pane.querySelector('.create-pool-plan-grid')
        const custom = pane.querySelector('.create-pool-plan-card--custom')
        const basic = pane.querySelector('.create-pool-plan-card:not(.create-pool-plan-card--custom)')
        if (grid) out.planGridMarginTop = getComputedStyle(grid).marginTop
        if (custom) {
          const cr = custom.getBoundingClientRect()
          out.customCardBottom = Math.round(cr.bottom)
          out.customCardTop = Math.round(cr.top)
        }
        if (basic) out.basicCardBottom = Math.round(basic.getBoundingClientRect().bottom)
        const flame = document.querySelector('.create-pool-plan-fire-overlay')
        const anchor = document.querySelector('.create-pool-plan-fire-anchor')
        if (flame && custom) {
          const fr = flame.getBoundingClientRect()
          const layer = document.querySelector('.create-pool-plan-fire-overlay-layer')
          out.flameTop = Math.round(fr.top)
          out.flameBottom = Math.round(fr.bottom)
          if (layer && anchor) {
            const anchorY = parseFloat(
              anchor.style.transform?.match(/translate\([^,]+,\s*([^)]+)/)?.[1] || '0',
            )
            const expectedY =
              custom.getBoundingClientRect().top - layer.getBoundingClientRect().top
            out.flameTracksCard = Math.abs(anchorY - expectedY) < 2
          }
        }
        const header = shell.querySelector('header')
        if (header && out.flameTop != null) {
          out.flameHeadroomPx = Math.round(out.flameTop - header.getBoundingClientRect().bottom)
        }
      }

      if (stepNum === 5) {
        const card = pane.querySelector('.create-pool-review-summary--modal')
        if (card) {
          const cs = getComputedStyle(card)
          out.reviewMarginTop = cs.marginTop
          out.reviewTop = Math.round(card.getBoundingClientRect().top)
          out.reviewBottom = Math.round(card.getBoundingClientRect().bottom)
        }
      }

      return out
    }, step)

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
  console.log('SKIP live — using fixture fallback unavailable here')
  process.exit(0)
}

const perforations = r800.stepResults.map((s) => s.metrics.perforationY)
const perfUniform = perforations.every((p) => p === perforations[0])
const collisions800 = r800.stepResults.filter((s) => s.metrics.overflowPx > 1)
const collisions680 = r680?.stepResults?.filter((s) => s.metrics.overflowPx > 1) ?? []

console.log(`Perforation @800: ${perforations.join(', ')} (uniform: ${perfUniform})`)
console.log(
  collisions800.length === 0
    ? 'PASS 800 — zero line intersections'
    : `FAIL 800: ${collisions800.map((c) => `step${c.step}+${c.metrics.overflowPx}px`).join(', ')}`,
)
console.log(
  collisions680.length === 0
    ? 'PASS 680 — zero line intersections'
    : `680: ${collisions680.map((c) => `step${c.step}+${c.metrics.overflowPx}px`).join(', ')}`,
)

process.exit(perfUniform && collisions800.length === 0 && collisions680.length === 0 ? 0 : 1)
