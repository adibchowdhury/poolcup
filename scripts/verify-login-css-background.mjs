/**
 * Verify CSS/SVG login background at multiple viewports + side-by-side vs raster.
 * Usage: node scripts/verify-login-css-background.mjs
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import sharp from 'sharp'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const viewports = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
]

const browser = await chromium.launch({ headless: true })
let allPass = true

for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  })

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  const metrics = await page.evaluate(() => {
    const main = document.querySelector('main.login-page-shell')
    if (!main) return { error: 'missing .login-page-shell' }
    const cs = getComputedStyle(main)
    const images = cs.backgroundImage
    const hasSvgData =
      images.includes('data:image/svg+xml;base64,') ||
      images.includes('data:image/svg+xml;base64')
    const hasGradient = /linear-gradient/i.test(images)
    const hasRasterRef = /login_background\.(png|webp)/i.test(images)

    // Probe a background-only strip (left of card) for footprint luminance variance
    const card = main.querySelector(':scope > div')
    const cardBox = card?.getBoundingClientRect()
    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 120
    // Can't read CSS backgrounds via canvas easily — use DOM pixel probe via screenshot path instead.
    return {
      fillsViewport:
        Math.abs(main.getBoundingClientRect().height - window.innerHeight) < 2 ||
        main.getBoundingClientRect().height >= window.innerHeight,
      hasSvgData,
      hasGradient,
      hasRasterRef,
      bgSize: cs.backgroundSize,
      bgRepeat: cs.backgroundRepeat,
      bgImagePrefix: images.slice(0, 120),
      cardTop: cardBox ? Math.round(cardBox.top) : null,
    }
  })

  const shotPath = resolve(outDir, `login-css-bg-${vp.name}.png`)
  await page.screenshot({ path: shotPath, fullPage: false })

  // Confirm footprints actually paint: sample left gutter pixels for variance
  const buf = readFileSync(shotPath)
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  // Sample a 80×80 patch in upper-left (away from card)
  const patchX = 20
  const patchY = 20
  const patchW = 80
  const patchH = 80
  const lums = []
  for (let y = patchY; y < patchY + patchH; y += 2) {
    for (let x = patchX; x < patchX + patchW; x += 2) {
      const i = (y * info.width + x) * 4
      lums.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2])
    }
  }
  const mean = lums.reduce((a, b) => a + b, 0) / lums.length
  const variance =
    lums.reduce((a, b) => a + (b - mean) ** 2, 0) / lums.length
  const footprintSignal = variance > 0.8 // subtle pattern still has measurable variance

  const pass =
    !metrics.error &&
    metrics.fillsViewport &&
    metrics.hasSvgData &&
    metrics.hasGradient &&
    !metrics.hasRasterRef &&
    footprintSignal

  if (!pass) allPass = false

  console.log(`\n=== ${vp.name} ===`)
  console.log(JSON.stringify({ ...metrics, mean: +mean.toFixed(2), variance: +variance.toFixed(2), footprintSignal, pass }, null, 2))
  console.log(`shot: ${shotPath}`)
  await page.close()
}

// Side-by-side: old raster screenshot vs new CSS at 1280
const oldPath = resolve(outDir, 'login-bg-1280x800.png')
const newPath = resolve(outDir, 'login-css-bg-1280x800.png')
const sidePath = resolve(outDir, 'login-bg-old-vs-css-1280x800.png')

if (existsSync(oldPath) && existsSync(newPath)) {
  const targetH = 800
  const oldImg = sharp(oldPath).resize({ height: targetH })
  const newImg = sharp(newPath).resize({ height: targetH })
  const oldMeta = await oldImg.metadata()
  const newMeta = await newImg.metadata()
  const gap = 8
  const ow = oldMeta.width ?? 1280
  const nw = newMeta.width ?? 1280
  const canvasW = ow + gap + nw
  const oldBuf = await sharp(oldPath).resize({ height: targetH }).png().toBuffer()
  const newBuf = await sharp(newPath).resize({ height: targetH }).png().toBuffer()
  // Labels bar
  const labelH = 36
  const svgLabel = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${labelH}">
      <rect width="100%" height="100%" fill="#0b1522"/>
      <text x="${ow / 2}" y="24" text-anchor="middle" fill="#9fb0bc" font-family="sans-serif" font-size="14">OLD — raster WebP</text>
      <text x="${ow + gap + nw / 2}" y="24" text-anchor="middle" fill="#9fb0bc" font-family="sans-serif" font-size="14">NEW — CSS gradient + SVG tile</text>
    </svg>`,
  )
  await sharp({
    create: {
      width: canvasW,
      height: targetH + labelH,
      channels: 3,
      background: '#0b1522',
    },
  })
    .composite([
      { input: svgLabel, top: 0, left: 0 },
      { input: oldBuf, top: labelH, left: 0 },
      { input: newBuf, top: labelH, left: ow + gap },
    ])
    .png()
    .toFile(sidePath)
  console.log(`\nSide-by-side: ${sidePath}`)
} else {
  console.log('\nSide-by-side skipped (missing old or new 1280 shot)')
  allPass = false
}

await browser.close()
console.log(`\n=== Overall: ${allPass ? 'PASS' : 'FAIL'} ===`)
process.exit(allPass ? 0 : 1)
