import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const src = 'public/login_assets/login_background.png'

const img = sharp(src)
const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true })
const w = info.width
const h = info.height

const lum = new Float32Array(w * h)
for (let i = 0; i < w * h; i++) {
  const o = i * 4
  lum[i] = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]
}

const x0 = 180
const y0 = 120
const ww = 600
const hh = 500
const residual = new Float32Array(ww * hh)
const R = 15

for (let y = 0; y < hh; y++) {
  for (let x = 0; x < ww; x++) {
    let sum = 0
    let n = 0
    for (let dy = -R; dy <= R; dy += 3) {
      for (let dx = -R; dx <= R; dx += 3) {
        const xx = x0 + x + dx
        const yy = y0 + y + dy
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) {
          sum += lum[yy * w + xx]
          n++
        }
      }
    }
    residual[y * ww + x] = lum[(y0 + y) * w + (x0 + x)] - sum / n
  }
}

const thr = 2.2
const peaks = []
for (let y = 8; y < hh - 8; y++) {
  for (let x = 8; x < ww - 8; x++) {
    const v = residual[y * ww + x]
    if (v < thr) continue
    let isMax = true
    for (let dy = -4; dy <= 4 && isMax; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (dx === 0 && dy === 0) continue
        if (residual[(y + dy) * ww + (x + dx)] > v) {
          isMax = false
          break
        }
      }
    }
    if (isMax) peaks.push({ x: x0 + x, y: y0 + y, v })
  }
}

peaks.sort((a, b) => b.v - a.v)
const kept = []
for (const p of peaks) {
  if (kept.some((k) => (k.x - p.x) ** 2 + (k.y - p.y) ** 2 < 12 * 12)) continue
  kept.push(p)
}

kept.sort((a, b) => a.y - b.y || a.x - b.x)
const rows = []
for (const p of kept) {
  const row = rows.find((r) => Math.abs(r.y - p.y) < 8)
  if (row) {
    row.pts.push(p)
    row.y = (row.y * (row.pts.length - 1) + p.y) / row.pts.length
  } else {
    rows.push({ y: p.y, pts: [p] })
  }
}
rows.sort((a, b) => a.y - b.y)

const report = {
  peaks: kept.length,
  rows: rows.length,
  rowDetails: [],
  rowGaps: [],
  stagger: null,
  footprint: null,
  alpha: null,
}

for (let i = 0; i < Math.min(rows.length, 14); i++) {
  const r = rows[i]
  r.pts.sort((a, b) => a.x - b.x)
  const xs = r.pts.map((p) => p.x)
  const gaps = []
  for (let j = 1; j < xs.length; j++) gaps.push(xs[j] - xs[j - 1])
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
  report.rowDetails.push({
    i,
    y: Math.round(r.y),
    n: r.pts.length,
    x0: xs[0],
    gap: avgGap,
    xs: xs.slice(0, 10),
  })
}

const rowYs = rows.map((r) => r.y)
for (let i = 1; i < rowYs.length; i++) report.rowGaps.push(rowYs[i] - rowYs[i - 1])
report.medianRowGap = [...report.rowGaps].sort((a, b) => a - b)[
  Math.floor(report.rowGaps.length / 2)
]

if (rows.length >= 4) {
  const deltas = []
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i].pts.map((p) => p.x).sort((x, y) => x - y)
    const b = rows[i + 1].pts.map((p) => p.x).sort((x, y) => x - y)
    deltas.push(b[0] - a[0])
  }
  report.stagger = { deltas: deltas.slice(0, 10), mean: deltas.reduce((a, b) => a + b, 0) / deltas.length }
}

const p = kept[Math.floor(kept.length / 2)]
let minx = 999
let miny = 999
let maxx = 0
let maxy = 0
for (let dy = -30; dy <= 30; dy++) {
  for (let dx = -30; dx <= 30; dx++) {
    const xx = p.x + dx
    const yy = p.y + dy
    if (xx < x0 || yy < y0 || xx >= x0 + ww || yy >= y0 + hh) continue
    const v = residual[(yy - y0) * ww + (xx - x0)]
    if (v > 1.0) {
      minx = Math.min(minx, dx)
      maxx = Math.max(maxx, dx)
      miny = Math.min(miny, dy)
      maxy = Math.max(maxy, dy)
    }
  }
}
report.footprint = {
  peak: p,
  w: maxx - minx + 1,
  h: maxy - miny + 1,
  dx: [minx, maxx],
  dy: [miny, maxy],
}

const pi = (p.y * w + p.x) * 4
const bgSample = []
for (const [dx, dy] of [
  [22, 0],
  [-22, 0],
  [0, 22],
  [0, -22],
  [18, 18],
  [-18, 18],
]) {
  const o = ((p.y + dy) * w + (p.x + dx)) * 4
  bgSample.push([data[o], data[o + 1], data[o + 2]])
}
const bg = [0, 1, 2].map((c) => bgSample.reduce((s, v) => s + v[c], 0) / bgSample.length)
const fg = [data[pi], data[pi + 1], data[pi + 2]]
const alphas = fg.map((f, i) => (f - bg[i]) / (255 - bg[i]))
report.alpha = {
  fg,
  bg: bg.map((v) => Math.round(v)),
  alphas,
  mean: alphas.reduce((a, b) => a + b, 0) / 3,
}

// Export annotated crop for visual inspection
const outDir = resolve('scripts/.screenshots')
mkdirSync(outDir, { recursive: true })
const annotated = Buffer.from(data)
for (const peak of kept.slice(0, 80)) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const xx = peak.x + dx
      const yy = peak.y + dy
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
      const o = (yy * w + xx) * 4
      annotated[o] = 255
      annotated[o + 1] = 0
      annotated[o + 2] = 0
    }
  }
}
await sharp(annotated, { raw: { width: w, height: h, channels: 4 } })
  .extract({ left: x0, top: y0, width: ww, height: hh })
  .png()
  .toFile(resolve(outDir, 'login-bg-footprint-peaks.png'))

// Also export a high-contrast residual preview
const resRgb = Buffer.alloc(ww * hh * 3)
for (let i = 0; i < ww * hh; i++) {
  const v = Math.max(0, Math.min(255, Math.round(residual[i] * 18)))
  resRgb[i * 3] = v
  resRgb[i * 3 + 1] = v
  resRgb[i * 3 + 2] = v
}
await sharp(resRgb, { raw: { width: ww, height: hh, channels: 3 } })
  .png()
  .toFile(resolve(outDir, 'login-bg-footprint-residual.png'))

writeFileSync(resolve(outDir, 'login-bg-pattern-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
