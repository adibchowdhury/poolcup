// run: node scripts/optimize-onboarding-mascots.mjs
// Compresses onboarding Pucky PNGs → WebP at display resolution.
import sharp from 'sharp'
import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { basename, join } from 'path'

const DIR = 'public/mascot/onboarding_mascot'
const ORIGINAL_DIR = join(DIR, 'original')
/** ~2× sm:h-64 (256px) display; enough for retina without huge assets. */
const WIDTH = 400
const WEBP_QUALITY = 82

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function writeWithRetry(path, buffer) {
  for (let i = 0; i < 5; i++) {
    try {
      await writeFile(path, buffer)
      return
    } catch (e) {
      if (i === 4) throw e
      await sleep(300)
    }
  }
}

if (!existsSync(DIR)) {
  console.error(`missing: ${DIR}`)
  process.exit(1)
}
if (!existsSync(ORIGINAL_DIR)) mkdirSync(ORIGINAL_DIR, { recursive: true })

// Preserve any PNGs still in DIR as originals, then optimize from original/
for (const f of readdirSync(DIR).filter((n) => n.toLowerCase().endsWith('.png'))) {
  const from = join(DIR, f)
  const to = join(ORIGINAL_DIR, f)
  if (!existsSync(to)) renameSync(from, to)
  else renameSync(from, join(ORIGINAL_DIR, `${Date.now()}-${f}`))
}

const sources = readdirSync(ORIGINAL_DIR).filter((f) =>
  f.toLowerCase().endsWith('.png'),
)
if (sources.length === 0) {
  console.error('No PNG sources in original/')
  process.exit(1)
}

let beforeTotal = 0
let afterTotal = 0
for (const f of sources) {
  // Skip timestamped duplicates if any
  if (/^\d+-pucky_/.test(f)) continue
  const src = join(ORIGINAL_DIR, f)
  const before = statSync(src).size
  beforeTotal += before
  const input = await readFile(src)
  const outName = `${basename(f, '.png')}.webp`
  const outPath = join(DIR, outName)
  const out = await sharp(input)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toBuffer()
  await writeWithRetry(outPath, out)
  afterTotal += out.length
  console.log(
    `${f}: ${(before / 1024).toFixed(1)}KB → ${outName} ${(out.length / 1024).toFixed(1)}KB`,
  )
}
console.log(
  `total: ${(beforeTotal / 1024).toFixed(1)}KB → ${(afterTotal / 1024).toFixed(1)}KB`,
)
