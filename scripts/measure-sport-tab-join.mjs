/**
 * Measure create-wizard sport↔panel tab-join in a rendered browser.
 * Mirrors modal card + scroll-pane overflow (same as wizard panes).
 *
 * Usage: node scripts/measure-sport-tab-join.mjs [--label before|after] [--width 1280]
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const label = process.argv.includes('--label')
  ? process.argv[process.argv.indexOf('--label') + 1]
  : 'measure'
const widthArg = process.argv.includes('--width')
  ? Number(process.argv[process.argv.indexOf('--width') + 1])
  : 1280
const viewportWidth = Number.isFinite(widthArg) ? widthArg : 1280
const viewportHeight = 800

const cssPath = resolve(process.cwd(), 'components/create/create-competition-step.css')
const css = readFileSync(cssPath, 'utf8')
const outDir = resolve(process.cwd(), 'scripts/output')
mkdirSync(outDir, { recursive: true })

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    :root { --primary: #00e676; --primary-foreground: #04120a; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0a;
      font-family: system-ui, sans-serif;
    }
    /* Modal card — matches CREATE_POOL_CARD_MODAL_CLASS */
    .modal-card {
      width: min(48rem, calc(100vw - 3rem));
      height: min(90vh, 720px);
      padding: 2rem;
      border: 2px solid #292929;
      border-radius: 1rem;
      background: #111111;
      color: #f0f4f8;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .modal-header { flex-shrink: 0; text-align: center; margin-bottom: 0; }
    .modal-header h1 { margin: 0; font-size: 1.5rem; font-weight: 600; }
    .stepper-stub { height: 2.75rem; margin-top: 0.75rem; opacity: 0.35; }
    /* Wizard slide pane: overflow-x-hidden clips negative-margin joins */
    .slide-pane {
      margin-top: 2rem;
      flex: 1 1 0;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      padding-left: 0.375rem;
      padding-right: 0.375rem;
    }
    ${css}
  </style>
</head>
<body>
  <div class="modal-card" id="modal-card">
    <div class="modal-header">
      <h1>Choose a competition</h1>
      <div class="stepper-stub" aria-hidden></div>
    </div>
    <div class="slide-pane" id="slide-pane">
      <div class="create-competition-step">
        <p class="create-competition-step__subhead">What are you predicting?</p>
        <div class="create-competition-step__layout" id="layout">
          <div class="create-competition-step__rail-col" id="rail-col">
            <div class="create-competition-step__rail" role="tablist">
              <button type="button" class="create-competition-step__sport" aria-selected="true" id="selected-sport">
                <span class="create-competition-step__sport-ball" style="width:28px;height:28px;background:#333;border-radius:50%;display:block;flex-shrink:0"></span>
                <span class="create-competition-step__sport-label">Soccer</span>
              </button>
              <button type="button" class="create-competition-step__sport" aria-selected="false">
                <span class="create-competition-step__sport-ball" style="width:28px;height:28px;background:#333;border-radius:50%;display:block;flex-shrink:0"></span>
                <span class="create-competition-step__sport-label">Basketball</span>
              </button>
            </div>
          </div>
          <div class="create-competition-step__panel" id="panel">
            <div class="create-competition-step__panel-header">
              <p class="create-competition-step__eyebrow">Competitions · Soccer</p>
              <p class="create-competition-step__eyebrow">02 available</p>
            </div>
            <div class="create-competition-step__list">
              <button type="button" class="create-competition-step__row">
                <span class="create-competition-step__crest"></span>
                <span class="create-competition-step__meta">
                  <span class="create-competition-step__name">World Cup 2026</span>
                  <span class="create-competition-step__season">2026</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`

function parseColor(cssColor) {
  if (!cssColor) return { r: 0, g: 0, b: 0, a: 1, raw: cssColor }
  const rgba = cssColor.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/,
  )
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] != null ? Number(rgba[4]) : 1,
      raw: cssColor,
    }
  }
  const srgb = cssColor.match(
    /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\)/,
  )
  if (srgb) {
    return {
      r: Math.round(Number(srgb[1]) * 255),
      g: Math.round(Number(srgb[2]) * 255),
      b: Math.round(Number(srgb[3]) * 255),
      a: srgb[4] != null ? Number(srgb[4]) : 1,
      raw: cssColor,
    }
  }
  return { r: 0, g: 0, b: 0, a: 1, raw: cssColor }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: viewportWidth, height: viewportHeight },
  deviceScaleFactor: 2,
})

await page.setContent(html, { waitUntil: 'load' })
await page.waitForTimeout(100)

const report = await page.evaluate(() => {
  const layout = document.getElementById('layout')
  const selected = document.getElementById('selected-sport')
  const panel = document.getElementById('panel')
  const card = document.getElementById('modal-card')
  const pane = document.getElementById('slide-pane')

  const ls = getComputedStyle(layout)
  const ss = getComputedStyle(selected)
  const ps = getComputedStyle(panel)
  const cs = getComputedStyle(card)

  const sBox = selected.getBoundingClientRect()
  const pBox = panel.getBoundingClientRect()

  // Geometric gap: positive => visible gap (row ends left of panel)
  const gapPx = pBox.left - sBox.right

  // Sample pixels across the seam (mid-height of selected row)
  const y = Math.round(sBox.top + sBox.height / 2)
  const samples = []
  const startX = Math.floor(Math.min(sBox.right, pBox.left) - 6)
  for (let i = 0; i < 16; i++) {
    const x = startX + i
    const el = document.elementFromPoint(x, y)
    samples.push({
      x,
      y,
      tag: el?.id || el?.className?.toString?.().slice(0, 60) || null,
    })
  }

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    cardBg: cs.backgroundColor,
    paneOverflowX: getComputedStyle(pane).overflowX,
    layout: {
      columnGap: ls.columnGap,
      gridTemplateColumns: ls.gridTemplateColumns,
    },
    selected: {
      marginRight: ss.marginRight,
      paddingRight: ss.paddingRight,
      borderRightWidth: ss.borderRightWidth,
      borderRightStyle: ss.borderRightStyle,
      borderLeftWidth: ss.borderLeftWidth,
      borderColor: ss.borderColor,
      backgroundColor: ss.backgroundColor,
      borderRadius: ss.borderRadius,
      zIndex: ss.zIndex,
      box: {
        left: sBox.left,
        right: sBox.right,
        top: sBox.top,
        bottom: sBox.bottom,
        width: sBox.width,
        height: sBox.height,
      },
    },
    panel: {
      borderLeftWidth: ps.borderLeftWidth,
      borderLeftColor: ps.borderLeftColor,
      borderLeftStyle: ps.borderLeftStyle,
      backgroundColor: ps.backgroundColor,
      zIndex: ps.zIndex,
      box: {
        left: pBox.left,
        right: pBox.right,
        top: pBox.top,
        bottom: pBox.bottom,
        width: pBox.width,
        height: pBox.height,
      },
      // Inner content edge (after border)
      innerLeft: pBox.left + parseFloat(ps.borderLeftWidth || '0'),
    },
    gapPx,
    overlapIntoPanel: sBox.right - pBox.left,
    samples,
  }
})

// Canvas sample of actual pixel colors across the seam
const sBox = report.selected.box
const y = Math.round(sBox.top + sBox.height / 2)
const seamX = Math.round(Math.min(report.selected.box.right, report.panel.box.left))
const shot = await page.screenshot({
  type: 'png',
  clip: {
    x: Math.max(0, seamX - 40),
    y: Math.max(0, y - 40),
    width: 120,
    height: 80,
  },
})
const shotPath = resolve(outDir, `tab-join-${label}-w${viewportWidth}.png`)
writeFileSync(shotPath, shot)

// Full-page crop of the layout join for context
const layoutShot = await page.locator('#layout').screenshot({ type: 'png' })
writeFileSync(resolve(outDir, `tab-join-${label}-layout-w${viewportWidth}.png`), layoutShot)

const selectedColor = parseColor(report.selected.backgroundColor)
const panelColor = parseColor(report.panel.backgroundColor)

const summary = {
  label,
  viewportWidth,
  ...report,
  selectedAlpha: selectedColor.a,
  panelAlpha: panelColor.a,
  selectedOpaque: selectedColor.a >= 0.999,
  panelOpaque: panelColor.a >= 0.999,
  screenshot: shotPath,
  diagnosis:
    report.gapPx > 0.5
      ? 'GEOMETRIC_GAP'
      : selectedColor.a < 0.999 || panelColor.a < 0.999
        ? 'TRANSLUCENT_FILL'
        : report.overlapIntoPanel < 1
          ? 'INSUFFICIENT_OVERLAP'
          : 'OK_OR_BORDER_SEAM',
}

console.log(JSON.stringify(summary, null, 2))
await browser.close()
