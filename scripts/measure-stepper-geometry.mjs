/**
 * Measure create-wizard stepper geometry at 1280×800.
 * Verifies: connectors on circle midline, butt circle edges, 88% spread, labels fit.
 */
import { chromium } from 'playwright'

const STEPPER_GREEN = '#00e676'
const TRACK = 44
const LABELS = ['Competition', 'Pool Type', 'Details', 'Plan', 'Review']

function stepperHtml(currentStep) {
  const steps = LABELS.map((label, index) => {
    const n = index + 1
    const status =
      currentStep > n ? 'completed' : currentStep === n ? 'current' : 'upcoming'
    const size = status === 'current' ? 44 : 36
    const radius = size / 2
    return `
    <li class="step" data-status="${status}" data-radius="${radius}" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center">
      <div class="track" style="position:relative;display:flex;width:100%;height:${TRACK}px;align-items:center;justify-content:center">
        ${
          index > 0
            ? `<span class="line-left" style="position:absolute;top:50%;left:0;right:calc(50% + ${radius}px);height:2px;transform:translateY(-50%);background:${STEPPER_GREEN}"></span>`
            : ''
        }
        ${
          index < LABELS.length - 1
            ? `<span class="line-right" style="position:absolute;top:50%;right:0;left:calc(50% + ${radius}px);height:2px;transform:translateY(-50%);background:${STEPPER_GREEN}"></span>`
            : ''
        }
        <div class="circle" style="position:relative;z-index:10;width:${size}px;height:${size}px;border-radius:999px;border:2px solid ${STEPPER_GREEN};background:#111;box-sizing:border-box"></div>
      </div>
      <span class="label" style="margin-top:6px;max-width:100%;padding:0 2px;font-size:11px;font-weight:${status === 'current' ? 600 : 500};text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${status === 'current' ? '#00e676' : '#5a7080'}">${label}</span>
    </li>`
  }).join('')

  return `<!DOCTYPE html><html><head><style>
    *{box-sizing:border-box} body{margin:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#f0f4f8}
    .modal{width:min(48rem,calc(100vw - 3rem));height:min(90vh,720px);margin:40px auto;padding:2rem;border:2px solid #292929;border-radius:1rem;background:#111}
    nav{display:flex;justify-content:center;width:100%}
    ol{display:flex;width:88%;list-style:none;margin:0;padding:0;gap:0}
  </style></head><body>
  <div class="modal"><nav><ol>${steps}</ol></nav></div>
  </body></html>`
}

async function measure(currentStep) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.setContent(stepperHtml(currentStep), { waitUntil: 'load' })

  const report = await page.evaluate(() => {
    const ol = document.querySelector('ol')
    const modal = document.querySelector('.modal')
    const steps = Array.from(document.querySelectorAll('.step'))
    const olBox = ol.getBoundingClientRect()
    const modalBox = modal.getBoundingClientRect()

    const circles = steps.map((step) => {
      const circle = step.querySelector('.circle')
      const track = step.querySelector('.track')
      const label = step.querySelector('.label')
      const lineLeft = step.querySelector('.line-left')
      const lineRight = step.querySelector('.line-right')
      const c = circle.getBoundingClientRect()
      const t = track.getBoundingClientRect()
      const l = label.getBoundingClientRect()
      const midY = t.top + t.height / 2
      let leftGap = null
      let rightGap = null
      let leftLineY = null
      let rightLineY = null
      if (lineLeft) {
        const lb = lineLeft.getBoundingClientRect()
        leftGap = Math.round((c.left - lb.right) * 100) / 100
        leftLineY = Math.round((lb.top + lb.height / 2) * 100) / 100
      }
      if (lineRight) {
        const rb = lineRight.getBoundingClientRect()
        rightGap = Math.round((rb.left - c.right) * 100) / 100
        rightLineY = Math.round((rb.top + rb.height / 2) * 100) / 100
      }
      return {
        status: step.getAttribute('data-status'),
        circleMidY: Math.round((c.top + c.height / 2) * 100) / 100,
        trackMidY: Math.round(midY * 100) / 100,
        leftGap,
        rightGap,
        leftLineY,
        rightLineY,
        labelText: label.textContent,
        labelWidth: Math.round(l.width),
        labelLeft: Math.round(l.left),
        labelRight: Math.round(l.right),
        circleWidth: Math.round(c.width),
      }
    })

    const labelGaps = []
    for (let i = 0; i < circles.length - 1; i++) {
      const gap = circles[i + 1].labelLeft - circles[i].labelRight
      labelGaps.push({
        pair: `${circles[i].labelText} → ${circles[i + 1].labelText}`,
        gapPx: gap,
      })
    }
    const tightest = labelGaps.reduce((a, b) => (b.gapPx < a.gapPx ? b : a))

    return {
      stepperWidth: Math.round(olBox.width),
      modalInnerWidth: Math.round(modalBox.width - 64), // p-8
      spreadPct: Math.round((olBox.width / (modalBox.width - 64)) * 1000) / 10,
      circles,
      labelGaps,
      tightest,
      linesCentered: circles.every(
        (c) =>
          Math.abs(c.circleMidY - c.trackMidY) < 1 &&
          (c.leftLineY == null || Math.abs(c.leftLineY - c.circleMidY) < 1.5) &&
          (c.rightLineY == null || Math.abs(c.rightLineY - c.circleMidY) < 1.5),
      ),
      linesTouching: circles.every(
        (c) =>
          (c.leftGap == null || Math.abs(c.leftGap) <= 1) &&
          (c.rightGap == null || Math.abs(c.rightGap) <= 1),
      ),
    }
  })

  await browser.close()
  return { currentStep, ...report }
}

const reports = []
for (let step = 1; step <= 5; step++) {
  reports.push(await measure(step))
}
console.log(JSON.stringify(reports, null, 2))
