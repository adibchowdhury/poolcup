/**
 * Measure transparent window bounds in pucky-login-frame.png
 */
import sharp from 'sharp'
import { writeFileSync } from 'fs'

const src = 'public/login_assets/pucky-login-frame.png'
const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const w = info.width
const h = info.height
const ALPHA_CLEAR = 32 // nearly transparent

// Find rows/cols that are mostly clear in the middle band (window)
function alphaAt(x, y) {
  return data[(y * w + x) * 4 + 3]
}

// Scan for largest contiguous clear region near center
const isClear = (x, y) => alphaAt(x, y) < ALPHA_CLEAR

// Flood-ish: find clear bbox by scanning center outward for solid clear rectangle
// Sample a grid and find extents of clear pixels with clear neighbors
let minX = w
let minY = h
let maxX = 0
let maxY = 0
let clearCount = 0

// Focus on central 70% to avoid edge transparency
const x0 = Math.floor(w * 0.1)
const x1 = Math.floor(w * 0.9)
const y0 = Math.floor(h * 0.15)
const y1 = Math.floor(h * 0.9)

for (let y = y0; y < y1; y += 2) {
  for (let x = x0; x < x1; x += 2) {
    if (!isClear(x, y)) continue
    // require a small neighborhood clear (avoid fringe)
    if (
      isClear(x + 4, y) &&
      isClear(x - 4, y) &&
      isClear(x, y + 4) &&
      isClear(x, y - 4)
    ) {
      clearCount++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}

// Refine edges: for each side, find first/last mostly-clear line
function rowClearFrac(y, left, right) {
  let c = 0
  let n = 0
  for (let x = left; x <= right; x += 2) {
    n++
    if (isClear(x, y)) c++
  }
  return c / n
}

function colClearFrac(x, top, bottom) {
  let c = 0
  let n = 0
  for (let y = top; y <= bottom; y += 2) {
    n++
    if (isClear(x, y)) c++
  }
  return c / n
}

// Tighten using 55% clear threshold on lines
const thr = 0.55
while (minY < maxY && rowClearFrac(minY, minX, maxX) < thr) minY++
while (maxY > minY && rowClearFrac(maxY, minX, maxX) < thr) maxY--
while (minX < maxX && colClearFrac(minX, minY, maxY) < thr) minX++
while (maxX > minX && colClearFrac(maxX, minY, maxY) < thr) maxX--

const winW = maxX - minX + 1
const winH = maxY - minY + 1
const cx = (minX + maxX) / 2
const cy = (minY + maxY) / 2

const report = {
  image: { w, h },
  windowPx: {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    width: winW,
    height: winH,
    centerX: +cx.toFixed(1),
    centerY: +cy.toFixed(1),
  },
  fractions: {
    left: +(minX / w).toFixed(4),
    top: +(minY / h).toFixed(4),
    right: +(maxX / w).toFixed(4),
    bottom: +(maxY / h).toFixed(4),
    width: +(winW / w).toFixed(4),
    height: +(winH / h).toFixed(4),
    centerX: +(cx / w).toFixed(4),
    centerY: +(cy / h).toFixed(4),
  },
  // Offset of window center from image center (as fraction of image size)
  centerOffset: {
    xFrac: +((cx - w / 2) / w).toFixed(4),
    yFrac: +((cy - h / 2) / h).toFixed(4),
  },
  // To size Pucky so window ≈ card: puckyWidth = cardWidth / windowWidthFrac
  scaleFromWindowWidth: +(1 / (winW / w)).toFixed(3),
  clearSamples: clearCount,
}

writeFileSync(
  'scripts/.screenshots/pucky-frame-window-measure.json',
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))

// Debug: draw red rect on window for visual check
const overlay = Buffer.from(data)
for (let y = minY; y <= maxY; y++) {
  for (let x = minX; x <= maxX; x++) {
    if (y === minY || y === maxY || x === minX || x === maxX) {
      const i = (y * w + x) * 4
      overlay[i] = 255
      overlay[i + 1] = 0
      overlay[i + 2] = 0
      overlay[i + 3] = 255
    }
  }
}
await sharp(overlay, { raw: { width: w, height: h, channels: 4 } })
  .png()
  .toFile('scripts/.screenshots/pucky-frame-window-bounds.png')
