/**
 * After-shot + before/after side-by-side for login gradient tune.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import sharp from 'sharp'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(400)

const bg = await page.evaluate(() => getComputedStyle(document.querySelector('main.login-page-shell')).backgroundImage)
console.log('live background:', bg.slice(0, 280))

const afterPath = resolve(outDir, 'login-gradient-after-1280x800.png')
await page.screenshot({ path: afterPath, fullPage: false })
await browser.close()

const beforePath = resolve(outDir, 'login-gradient-before-1280x800.png')
const sidePath = resolve(outDir, 'login-gradient-tune-before-after-1280x800.png')

if (!existsSync(beforePath)) {
  console.error('missing before shot')
  process.exit(1)
}

const h = 800
const beforeBuf = await sharp(beforePath).resize({ height: h }).png().toBuffer()
const afterBuf = await sharp(afterPath).resize({ height: h }).png().toBuffer()
const beforeMeta = await sharp(beforeBuf).metadata()
const afterMeta = await sharp(afterBuf).metadata()
const ow = beforeMeta.width ?? 1280
const nw = afterMeta.width ?? 1280
const gap = 8
const labelH = 36
const canvasW = ow + gap + nw
const svgLabel = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${labelH}">
    <rect width="100%" height="100%" fill="#080b0f"/>
    <text x="${ow / 2}" y="24" text-anchor="middle" fill="#9fb0bc" font-family="sans-serif" font-size="14">BEFORE</text>
    <text x="${ow + gap + nw / 2}" y="24" text-anchor="middle" fill="#9fb0bc" font-family="sans-serif" font-size="14">AFTER — tuned poles</text>
  </svg>`,
)

await sharp({
  create: {
    width: canvasW,
    height: h + labelH,
    channels: 3,
    background: '#080b0f',
  },
})
  .composite([
    { input: svgLabel, top: 0, left: 0 },
    { input: beforeBuf, top: labelH, left: 0 },
    { input: afterBuf, top: labelH, left: ow + gap },
  ])
  .png()
  .toFile(sidePath)

console.log('after:', afterPath)
console.log('side-by-side:', sidePath)
