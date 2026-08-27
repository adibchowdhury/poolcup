import sharp from 'sharp'

const orig = await sharp('public/login_assets/pucky-login-frame.png')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const { data, info } = orig
const W = info.width
const H = info.height
const at = (x, y) => {
  x = Math.round(x)
  y = Math.round(y)
  const i = (y * W + x) * 4
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }
}
const isDark = (c) => c.a > 200 && c.r < 48 && c.g < 42 && c.b < 42

const eyes = [
  { cx: 0.4131 * W, cy: 0.4292 * H, w: 0.0768 * W, h: 0.1191 * H, name: 'L' },
  { cx: 0.5771 * W, cy: 0.4297 * H, w: 0.0794 * W, h: 0.1201 * H, name: 'R' },
]

for (const eye of eyes) {
  let darkIn = 0
  let darkOut = 0
  let ellipseNotDark = 0
  let ellipseN = 0
  const rx = eye.w / 2
  const ry = eye.h / 2
  for (let y = Math.floor(eye.cy - ry - 5); y <= eye.cy + ry + 5; y++) {
    for (let x = Math.floor(eye.cx - rx - 5); x <= eye.cx + rx + 5; x++) {
      const nx = (x - eye.cx) / rx
      const ny = (y - eye.cy) / ry
      const inside = nx * nx + ny * ny <= 1
      const dark = isDark(at(x, y))
      if (inside) {
        ellipseN++
        if (dark) darkIn++
        else ellipseNotDark++
      } else if (dark && Math.hypot(x - eye.cx, y - eye.cy) < Math.max(rx, ry) * 1.3) {
        darkOut++
      }
    }
  }
  console.log(eye.name, {
    coverDark: +(darkIn / (darkIn + darkOut || 1)).toFixed(4),
    ellipseFillDark: +(darkIn / ellipseN).toFixed(4),
    darkOut,
    ellipseNotDark,
    ellipseN,
  })
}

// Diff eyeless vs orig in ellipse: how much of hole is white
const eyeImg = await sharp('public/login_assets/pucky-login-frame-eyeless.png')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const atE = (x, y) => {
  x = Math.round(x)
  y = Math.round(y)
  const i = (y * W + x) * 4
  return { r: eyeImg.data[i], g: eyeImg.data[i + 1], b: eyeImg.data[i + 2], a: eyeImg.data[i + 3] }
}

for (const eye of eyes) {
  const rx = eye.w / 2
  const ry = eye.h / 2
  let holeWhite = 0
  let holeN = 0
  for (let y = Math.floor(eye.cy - ry); y <= eye.cy + ry; y++) {
    for (let x = Math.floor(eye.cx - rx); x <= eye.cx + rx; x++) {
      const nx = (x - eye.cx) / rx
      const ny = (y - eye.cy) / ry
      if (nx * nx + ny * ny > 1) continue
      holeN++
      const e = atE(x, y)
      const L = (e.r + e.g + e.b) / 3
      if (L > 160) holeWhite++
    }
  }
  console.log(eye.name, 'eyelessHoleWhiteRate', +(holeWhite / holeN).toFixed(4))
}
