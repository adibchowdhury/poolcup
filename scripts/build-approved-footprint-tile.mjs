/**
 * Build login wallpaper tile from approved asset
 * public/login_assets/poolcup_penguin_footprint.svg — shape untouched.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { chromium } from 'playwright'

const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const assetPath = resolve(process.cwd(), 'public/login_assets/poolcup_penguin_footprint.svg')
const asset = readFileSync(assetPath, 'utf8')

// Extract exact path d= from asset (shape only)
const pathMatch = asset.match(/<path[^>]*\bd="([^"]+)"/)
if (!pathMatch) {
  console.error('No path in asset')
  process.exit(1)
}
const pathD = pathMatch[1].replace(/\s+/g, ' ').trim()

const fillFinding = {
  authored: 'currentColor',
  note: 'currentColor in a CSS background-image data-URI resolves like black — invisible on dark gradient. Swap fill to #fff + fill-opacity only; path/viewBox untouched.',
  appliedFill: '#ffffff',
  fillOpacity: 0.085,
}

// Native: viewBox 0 0 100 140
const RENDER_H = 22 // px tall target (20–24) — LOCKED size
const SCALE = RENDER_H / 140
const RENDER_W = 100 * SCALE

// Previous pitch 76×58; +40% spacing (within 35–45%) → 106×81
const PITCH_X = 106
const PITCH_Y = 81
const TILE_W = PITCH_X
const TILE_H = PITCH_Y * 2 // 162

// Mobile density: prior ratio 65/76 ≈ 0.855
const MOBILE_RATIO = 65 / 76
const MOBILE_W = Math.round(TILE_W * MOBILE_RATIO)
const MOBILE_H = Math.round(TILE_H * MOBILE_RATIO)

function stamp(tx, ty) {
  // Center native 100×140 artbox on (tx, ty)
  return `<g transform="translate(${tx} ${ty}) scale(${SCALE.toFixed(6)}) translate(-50 -70)" fill="${fillFinding.appliedFill}" fill-opacity="${fillFinding.fillOpacity}"><path d="${pathD}"/></g>`
}

const tileSvg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${TILE_H}" viewBox="0 0 ${TILE_W} ${TILE_H}">`,
  stamp(TILE_W / 2, PITCH_Y / 2),
  stamp(0, PITCH_Y + PITCH_Y / 2),
  stamp(TILE_W, PITCH_Y + PITCH_Y / 2),
  '</svg>',
].join('')

const b64 = Buffer.from(tileSvg, 'utf8').toString('base64')
const cssUrl = `url("data:image/svg+xml;base64,${b64}")`

const report = {
  asset: 'public/login_assets/poolcup_penguin_footprint.svg',
  native: { viewBox: '0 0 100 140', width: 100, height: 140 },
  fillFinding,
  rendered: { heightPx: RENDER_H, widthPx: +RENDER_W.toFixed(2), scale: +SCALE.toFixed(6) },
  tile: { w: TILE_W, h: TILE_H, pitchX: PITCH_X, pitchY: PITCH_Y, stagger: PITCH_X / 2 },
  mobileTile: { w: MOBILE_W, h: MOBILE_H },
  opacity: fillFinding.fillOpacity,
  pathUnmodified: true,
  tileSvg,
  b64,
  cssUrl,
}

writeFileSync(resolve(outDir, 'login-approved-footprint-tile.json'), JSON.stringify(report, null, 2))

// Quick loadability check: paint tile over locked gradient in Chromium
const lockedGradient = `radial-gradient(circle at 50% 45%, rgba(0, 230, 118, 0.10) 0%, rgba(0, 230, 118, 0.025) 28%, transparent 52%), linear-gradient(125deg, #0a1f16 0%, #0a1411 32%, #0b1014 67%, #0d1522 100%)`
const html = `<!doctype html><html><body style="margin:0">
<div id="s" style="width:1280px;height:800px;background-image:${cssUrl}, ${lockedGradient};background-repeat:repeat,no-repeat,no-repeat;background-position:0 0,center,center;background-size:${TILE_W}px ${TILE_H}px,auto,auto"></div>
</body></html>`
const fixture = resolve(outDir, 'login-approved-footprint-probe.html')
writeFileSync(fixture, html)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(`file://${fixture.replace(/\\/g, '/')}`)
await page.waitForTimeout(200)
const probe = await page.evaluate(() => {
  const el = document.getElementById('s')
  const cs = getComputedStyle(el)
  return {
    hasDataUri: /data:image\/svg\+xml;base64,/.test(cs.backgroundImage),
    bgSize: cs.backgroundSize,
  }
})
await page.screenshot({
  path: resolve(outDir, 'login-approved-footprint-probe-1280.png'),
})
await browser.close()

console.log(JSON.stringify({ ...report, probe, tileSvgLen: tileSvg.length }, null, 2))
