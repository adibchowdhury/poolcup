import sharp from 'sharp'

const W = 368
const H = Math.round(368 * 1024 / 1536)

const eyes = [
  {
    iris: { cx: 0.4215, cy: 0.4385, w: 0.0605, h: 0.1002, color: '#0b0604' },
    pupil: { relW: 0.72, relH: 0.72, relX: 0, relY: 0.02, color: '#010101' },
    highlight: { relX: -0.343, relY: -0.358, sizeVsIris: 0.14 },
  },
  {
    iris: { cx: 0.5687, cy: 0.439, w: 0.0633, h: 0.0991, color: '#070706' },
    pupil: { relW: 0.72, relH: 0.72, relX: 0, relY: 0.02, color: '#030303' },
    highlight: { relX: -0.12, relY: -0.36, sizeVsIris: 0.14 },
  },
]

function ellipseSvg(cx, cy, rx, ry, fill) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" />`
}

let parts = ''
for (const eye of eyes) {
  const iw = eye.iris.w * W
  const ih = eye.iris.h * H
  const icx = eye.iris.cx * W
  const icy = eye.iris.cy * H
  parts += ellipseSvg(icx, icy, iw / 2, ih / 2, eye.iris.color)
  const pw = eye.pupil.relW * iw
  const ph = eye.pupil.relH * ih
  parts += ellipseSvg(
    icx + eye.pupil.relX * iw,
    icy + eye.pupil.relY * ih,
    pw / 2,
    ph / 2,
    eye.pupil.color,
  )
  const hs = eye.highlight.sizeVsIris * Math.min(iw, ih)
  parts += ellipseSvg(
    icx + eye.highlight.relX * iw,
    icy + eye.highlight.relY * ih,
    hs / 2,
    hs / 2,
    '#ffffff',
  )
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts}</svg>`
const overlay = Buffer.from(svg)

const base = await sharp('public/login_assets/pucky-login-frame-eyeless.png')
  .resize(W, H, { fit: 'fill' })
  .png()
  .toBuffer()
const composite = await sharp(base)
  .composite([{ input: overlay, blend: 'over' }])
  .png()
  .toBuffer()
const orig = await sharp('public/login_assets/pucky-login-frame.png')
  .resize(W, H, { fit: 'fill' })
  .png()
  .toBuffer()

await sharp(composite).toFile('scripts/.screenshots/pucky-idle-composite.png')
await sharp(orig).toFile('scripts/.screenshots/pucky-idle-original-scaled.png')

const face = {
  left: Math.round(W * 0.32),
  top: Math.round(H * 0.32),
  width: Math.round(W * 0.36),
  height: Math.round(H * 0.3),
}
const cFace = await sharp(composite).extract(face).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
const oFace = await sharp(orig).extract(face).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
await sharp(composite).extract(face).png().toFile('scripts/.screenshots/pucky-idle-composite-face.png')
await sharp(orig).extract(face).png().toFile('scripts/.screenshots/pucky-idle-original-face.png')

let sum = 0
let max = 0
let over40 = 0
const n = cFace.info.width * cFace.info.height
for (let i = 0; i < n; i++) {
  const o = i * 4
  const dr =
    Math.abs(cFace.data[o] - oFace.data[o]) +
    Math.abs(cFace.data[o + 1] - oFace.data[o + 1]) +
    Math.abs(cFace.data[o + 2] - oFace.data[o + 2])
  sum += dr
  max = Math.max(max, dr)
  if (dr > 40) over40++
}

const eyeBand = {
  left: Math.round(W * 0.38),
  top: Math.round(H * 0.36),
  width: Math.round(W * 0.24),
  height: Math.round(H * 0.2),
}
const cEye = await sharp(composite).extract(eyeBand).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
const oEye = await sharp(orig).extract(eyeBand).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
let sum2 = 0
let max2 = 0
let over2 = 0
const n2 = cEye.info.width * cEye.info.height
for (let i = 0; i < n2; i++) {
  const o = i * 4
  const dr =
    Math.abs(cEye.data[o] - oEye.data[o]) +
    Math.abs(cEye.data[o + 1] - oEye.data[o + 1]) +
    Math.abs(cEye.data[o + 2] - oEye.data[o + 2])
  sum2 += dr
  max2 = Math.max(max2, dr)
  if (dr > 40) over2++
}

console.log(
  JSON.stringify(
    {
      face: { avgDr: +(sum / n).toFixed(2), maxDr: max, over40Rate: +(over40 / n).toFixed(4) },
      eyeBand: { avgDr: +(sum2 / n2).toFixed(2), maxDr: max2, over40Rate: +(over2 / n2).toFixed(4) },
      frame: { W, H },
      verdict:
        sum2 / n2 < 30 && over2 / n2 < 0.15
          ? 'near-indistinguishable'
          : sum2 / n2 < 55
            ? 'close-acceptable'
            : 'visible-mismatch',
    },
    null,
    2,
  ),
)
