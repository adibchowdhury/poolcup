import sharp from 'sharp'
import fs from 'fs'

async function load(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height }
}

const orig = await load('public/login_assets/pucky-login-frame.png')
const eye = await load('public/login_assets/pucky-login-frame-eyeless.png')

const at = (img, x, y) => {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return { r: 0, g: 0, b: 0, a: 0 }
  const i = (y * img.w + x) * 4
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] }
}

// Match investigation: dark flood on original (charcoal disc), not only vs eyeless
const isDark = (c) => c.a > 200 && c.r < 48 && c.g < 42 && c.b < 42
const isSclera = (c) => {
  if (c.a < 200) return false
  const L = (c.r + c.g + c.b) / 3
  return L > 155 && c.r > 145 && c.g > 135 && c.b > 125 && c.r >= c.b - 15
}

function floodDark(seedX, seedY, maxR = 90) {
  const pts = []
  const seen = new Set()
  const q = [[seedX, seedY]]
  seen.add(seedX + ',' + seedY)
  while (q.length) {
    const [x, y] = q.pop()
    if (Math.hypot(x - seedX, y - seedY) > maxR) continue
    if (!isDark(at(orig, x, y))) continue
    pts.push({ x, y, o: at(orig, x, y) })
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx
        const ny = y + dy
        const k = nx + ',' + ny
        if (!seen.has(k)) {
          seen.add(k)
          q.push([nx, ny])
        }
      }
    }
  }
  return pts
}

function bbox(pts) {
  let minX = 1e9
  let maxX = 0
  let minY = 1e9
  let maxY = 0
  let sx = 0
  let sy = 0
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
    sx += p.x
    sy += p.y
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    densCx: sx / pts.length,
    densCy: sy / pts.length,
    n: pts.length,
  }
}

function findHighlightNear(iris, preferX, preferY) {
  // Bright compact specular on iris — search upper half preferentially near investigation hint
  const hi = []
  for (let y = iris.minY; y <= iris.maxY; y++) {
    for (let x = iris.minX; x <= iris.maxX; x++) {
      const o = at(orig, x, y)
      if (o.a > 200 && o.r >= 248 && o.g >= 248 && o.b >= 245) {
        let nearDark = 0
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (isDark(at(orig, x + dx, y + dy))) nearDark++
          }
        }
        if (nearDark >= 4) hi.push({ x, y })
      }
    }
  }
  if (!hi.length) return null

  // Connected components
  const set = new Set(hi.map((p) => p.x + ',' + p.y))
  const seen = new Set()
  const comps = []
  for (const p of hi) {
    const sk = p.x + ',' + p.y
    if (seen.has(sk)) continue
    const q = [sk]
    seen.add(sk)
    const pts = []
    while (q.length) {
      const k = q.pop()
      const [x, y] = k.split(',').map(Number)
      pts.push({ x, y })
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nk = x + dx + ',' + (y + dy)
          if (set.has(nk) && !seen.has(nk)) {
            seen.add(nk)
            q.push(nk)
          }
        }
      }
    }
    comps.push(pts)
  }

  // Score: prefer near investigation hint, compact (8–40 px), upper portion of iris
  let best = null
  let bestScore = -1e9
  for (const c of comps) {
    let sx = 0
    let sy = 0
    let minX = 1e9
    let maxX = 0
    let minY = 1e9
    let maxY = 0
    for (const p of c) {
      sx += p.x
      sy += p.y
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    const cx = sx / c.length
    const cy = sy / c.length
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const size = (w + h) / 2
    if (c.length < 3 || c.length > 120) continue
    if (size > 28) continue
    const distHint = Math.hypot(cx - preferX, cy - preferY)
    const upperBonus = cy < iris.cy ? 30 : 0
    const compactBonus = size < 16 ? 20 : 0
    const score = upperBonus + compactBonus - distHint + Math.min(c.length, 40)
    if (score > bestScore) {
      bestScore = score
      best = { cx, cy, w, h, size, n: c.length }
    }
  }
  return best
}

function measureEyeWhite(irisCx, irisCy) {
  // Radial extents until black outline (or non-sclera) — avoids flooding into face white
  const isOutlineOrFur = (c) => c.a > 200 && c.r < 60 && c.g < 55 && c.b < 55
  function extent(angle) {
    for (let r = 4; r < 180; r++) {
      const x = irisCx + Math.cos(angle) * r
      const y = irisCy + Math.sin(angle) * r
      const c = at(eye, x, y)
      if (c.a < 20) return r - 1
      if (isOutlineOrFur(c)) return r - 1
      if (!isSclera(c)) return r - 1
    }
    return 180
  }
  const angles = []
  for (let i = 0; i < 32; i++) angles.push((i / 32) * Math.PI * 2)
  const extents = angles.map(extent)
  // Approximate ellipse: avg |cos| weighted
  let sumRx = 0
  let sumRy = 0
  let nRx = 0
  let nRy = 0
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i]
    const e = extents[i]
    const c = Math.abs(Math.cos(a))
    const s = Math.abs(Math.sin(a))
    if (c >= s) {
      sumRx += e * c
      nRx += c
    } else {
      sumRy += e * s
      nRy += s
    }
  }
  const rx = sumRx / nRx
  const ry = sumRy / nRy
  return {
    cx: irisCx,
    cy: irisCy,
    w: rx * 2,
    h: ry * 2,
    densCx: irisCx,
    densCy: irisCy,
    minX: irisCx - rx,
    maxX: irisCx + rx,
    minY: irisCy - ry,
    maxY: irisCy + ry,
    n: extents.length,
    rx,
    ry,
  }
}

function hex(c) {
  return (
    '#' +
    [c.r, c.g, c.b]
      .map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0'))
      .join('')
  )
}

function analyze(label, seedX, seedY, hiHintX, hiHintY, eyeApprox) {
  const dark = floodDark(seedX, seedY, 95)
  const iris = bbox(dark)

  // Color sample: outer ring charcoal (not pure black center)
  const edge = []
  for (const p of dark) {
    const nx = (p.x - iris.densCx) / (iris.w / 2)
    const ny = (p.y - iris.densCy) / (iris.h / 2)
    const rr = nx * nx + ny * ny
    if (rr > 0.4 && rr < 0.92) {
      const L = p.o.r + p.o.g + p.o.b
      if (L >= 6 && L < 80) edge.push(p.o)
    }
  }
  edge.sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b))
  const irisColor = edge[Math.floor(edge.length * 0.45)] || { r: 14, g: 12, b: 11 }

  // Inner pupil: near-black core, ~55–65% of assembly
  const core = dark.filter((p) => p.o.r + p.o.g + p.o.b < 8)
  let pupil = { relW: 0.58, relH: 0.58, relX: 0, relY: 0.02 }
  if (core.length > 100) {
    const pb = bbox(core)
    // Soften with density radius
    const pd = core
      .map((p) => Math.hypot(p.x - pb.densCx, p.y - pb.densCy))
      .sort((a, b) => a - b)
    const pr = pd[Math.floor(pd.length * 0.65)]
    pupil = {
      relW: Math.min(0.72, (2 * pr) / iris.w),
      relH: Math.min(0.72, (2 * pr) / iris.h),
      relX: (pb.densCx - iris.cx) / iris.w,
      relY: (pb.densCy - iris.cy) / iris.h,
    }
  }

  const hi = findHighlightNear(iris, hiHintX, hiHintY)
  const eyeWhite = measureEyeWhite(iris.cx, iris.cy)

  let match = 0
  let diff = 0
  let sum = 0
  let maxDr = 0
  if (eyeWhite) {
    for (let y = Math.floor(eyeWhite.minY); y <= Math.ceil(eyeWhite.maxY); y++) {
      for (let x = Math.floor(eyeWhite.minX); x <= Math.ceil(eyeWhite.maxX); x++) {
        const nx = (x - eyeWhite.cx) / (eyeWhite.w / 2)
        const ny = (y - eyeWhite.cy) / (eyeWhite.h / 2)
        if (nx * nx + ny * ny > 1) continue
        const e = at(eye, x, y)
        if (!isSclera(e)) continue
        const o = at(orig, x, y)
        if (isDark(o)) continue
        const dr = Math.abs(o.r - e.r) + Math.abs(o.g - e.g) + Math.abs(o.b - e.b)
        sum += dr
        maxDr = Math.max(maxDr, dr)
        if (dr <= 30) match++
        else diff++
      }
    }
  }
  const n = match + diff || 1

  const out = {
    label,
    iris: {
      cxF: +(iris.cx / orig.w).toFixed(4),
      cyF: +(iris.cy / orig.h).toFixed(4),
      wF: +(iris.w / orig.w).toFixed(4),
      hF: +(iris.h / orig.h).toFixed(4),
      densCxF: +(iris.densCx / orig.w).toFixed(4),
      densCyF: +(iris.densCy / orig.h).toFixed(4),
      px: { ...iris },
      color: hex(irisColor),
      rgb: irisColor,
    },
    pupil,
    highlight: hi
      ? {
          cxF: +(hi.cx / orig.w).toFixed(4),
          cyF: +(hi.cy / orig.h).toFixed(4),
          sizeF: +((hi.size / Math.max(iris.w, iris.h))).toFixed(4),
          wF: +(hi.size / orig.w).toFixed(4),
          hF: +(hi.size / orig.h).toFixed(4),
          relX: +((hi.cx - iris.cx) / iris.w).toFixed(4),
          relY: +((hi.cy - iris.cy) / iris.h).toFixed(4),
          n: hi.n,
          px: hi,
        }
      : null,
    eye: eyeWhite
      ? {
          cxF: +(eyeWhite.cx / orig.w).toFixed(4),
          cyF: +(eyeWhite.cy / orig.h).toFixed(4),
          wF: +(eyeWhite.w / orig.w).toFixed(4),
          hF: +(eyeWhite.h / orig.h).toFixed(4),
          px: eyeWhite,
        }
      : null,
    scleraUnchanged: {
      match,
      diff,
      avgDr: +(sum / n).toFixed(2),
      maxDr,
      okRate: +(match / n).toFixed(4),
    },
  }
  return out
}

// Seeds from investigation pupil centers
const L = analyze('L', 635, 440, 0.394 * orig.w, 0.403 * orig.h, { cx: 603, cy: 475 })
const R = analyze('R', 870, 440, 0.566 * orig.w, 0.402 * orig.h, { cx: 915, cy: 477 })

// Body outside eyes unchanged
let outDiff = 0
let outN = 0
for (let y = 0; y < orig.h; y += 3) {
  for (let x = 0; x < orig.w; x += 3) {
    if (y >= 300 && y <= 560 && x >= 480 && x <= 1050) continue
    const o = at(orig, x, y)
    const e = at(eye, x, y)
    if (o.a < 200 || e.a < 200) continue
    outN++
    const dr = Math.abs(o.r - e.r) + Math.abs(o.g - e.g) + Math.abs(o.b - e.b)
    if (dr > 40) outDiff++
  }
}

const rh = 368 * (1024 / 1536)
function renderStats(eye) {
  const irisW = eye.iris.wF * 368
  const irisH = eye.iris.hF * rh
  const eyeW = eye.eye.wF * 368
  const eyeH = eye.eye.hF * rh
  const maxRadius = 0.11 * Math.min(eyeW, eyeH)
  const clampRx = eyeW / 2 - (irisW / 2) * 0.9
  const clampRy = eyeH / 2 - (irisH / 2) * 0.9
  return {
    iris: { w: +irisW.toFixed(2), h: +irisH.toFixed(2) },
    eye: { w: +eyeW.toFixed(2), h: +eyeH.toFixed(2) },
    maxRadiusPx: +maxRadius.toFixed(2),
    clampRxPx: +clampRx.toFixed(2),
    clampRyPx: +clampRy.toFixed(2),
  }
}

const report = {
  canvas: { w: 1536, h: 1024, same: true },
  investigationVsFullAssembly: {
    note: 'Investigation §2 listed pupil-only figures; full dark flood = iris assembly',
    invL: { cx: 0.4131, cy: 0.4292, w: 0.0768, h: 0.1191 },
    invR: { cx: 0.5771, cy: 0.4297, w: 0.0794, h: 0.1201 },
    nowL: { cx: L.iris.cxF, cy: L.iris.cyF, w: L.iris.wF, h: L.iris.hF },
    nowR: { cx: R.iris.cxF, cy: R.iris.cyF, w: R.iris.wF, h: R.iris.hF },
  },
  L,
  R,
  bodyOutsideEyes: { outDiff, outN, rate: +(outDiff / outN).toFixed(5) },
  at368: { frameH: +rh.toFixed(2), L: renderStats(L), R: renderStats(R) },
}

fs.writeFileSync('scripts/.screenshots/pucky-eye-calib.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
