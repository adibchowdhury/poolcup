/**
 * Verify Make Your Picks rail cards at 1280px — compact layout + no aspect-ratio warnings.
 * Usage: node scripts/verify-make-your-picks-rail.mjs
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const env = loadEnvLocal()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: members } = await admin
  .from('pool_members')
  .select('user_id')
  .limit(100)

if (!members?.length) {
  console.error('No pool members for auth')
  process.exit(1)
}

const { fetchMakeYourPicksQueue } = await import(
  '../src/lib/fetch-make-your-picks-queue.ts'
)

let email = null
const seen = new Set()
for (const row of members) {
  if (seen.has(row.user_id)) continue
  seen.add(row.user_id)
  const queue = await fetchMakeYourPicksQueue(admin, row.user_id)
  if (queue.matches.length > 0) {
    const { data: userData } = await admin.auth.admin.getUserById(row.user_id)
    email = userData?.user?.email ?? null
    if (email) break
  }
}

if (!email) {
  const { data: userData } = await admin.auth.admin.getUserById(members[0].user_id)
  email = userData?.user?.email
}

if (!email) {
  console.error('No user email')
  process.exit(1)
}

const { data: linkData } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo: `${baseUrl}/auth/callback` },
})

const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(`${baseUrl}/auth/callback`)}`

const aspectRatioWarnings = []
const consoleMessages = []

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

page.on('console', (msg) => {
  const text = msg.text()
  consoleMessages.push({ type: msg.type(), text })
  if (
    /has either width or height modified|aspect ratio/i.test(text) &&
    /\/sports\//i.test(text)
  ) {
    aspectRatioWarnings.push(text)
  }
})

async function signIn() {
  await page.goto(verifyUrl, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  const afterAuthUrl = page.url()
  const hashParams = Object.fromEntries(
    new URL(afterAuthUrl).hash
      .replace(/^#/, '')
      .split('&')
      .map((part) => {
        const i = part.indexOf('=')
        return i === -1 ? [part, ''] : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))]
      }),
  )
  if (hashParams.access_token && hashParams.refresh_token) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      async ({ url, key, access_token, refresh_token }) => {
        const { createBrowserClient } = await import(
          'https://cdn.jsdelivr.net/npm/@supabase/ssr@0.6.1/+esm'
        )
        const client = createBrowserClient(url, key)
        await client.auth.setSession({ access_token, refresh_token })
      },
      {
        url: supabaseUrl,
        key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        access_token: hashParams.access_token,
        refresh_token: hashParams.refresh_token,
      },
    )
    await page.waitForTimeout(2000)
  }
}

await signIn()
await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)

const section = page.locator('[data-feed-section="make-your-picks"][data-surface="rail"]')
await section.waitFor({ state: 'visible', timeout: 30000 })

const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })
const shotPath = resolve(outDir, 'make-your-picks-rail-1280x800.png')
await section.screenshot({ path: shotPath })

const metrics = await page.evaluate(() => {
  const sectionEl = document.querySelector(
    '[data-feed-section="make-your-picks"][data-surface="rail"]',
  )
  if (!sectionEl) return { error: 'section missing' }

  const cards = sectionEl.querySelectorAll('article')
  const cardMetrics = []
  for (const card of cards) {
    const cardBox = card.getBoundingClientRect()
    const sportImg = card.querySelector('img[src*="/sports/"]')
    const predictBtn = card.querySelector('a[href*="/match"], button, a')
    const imgBox = sportImg?.getBoundingClientRect()
    cardMetrics.push({
      cardHeight: Math.round(cardBox.height),
      cardWidth: Math.round(cardBox.width),
      sportIconW: imgBox ? Math.round(imgBox.width) : null,
      sportIconH: imgBox ? Math.round(imgBox.height) : null,
      sportIconInsideCard:
        imgBox &&
        imgBox.right <= cardBox.right + 2 &&
        imgBox.bottom <= cardBox.bottom + 2,
    })
  }

  return {
    cardCount: cards.length,
    cardMetrics,
  }
})

await browser.close()

console.log('\n=== Make Your Picks rail @1280×800 ===')
console.log(`Screenshot: ${shotPath}`)
console.log(JSON.stringify(metrics, null, 2))

console.log('\n=== Aspect-ratio warnings (/sports/*.png) ===')
if (aspectRatioWarnings.length === 0) {
  console.log('PASS — zero sports aspect-ratio warnings')
} else {
  console.log(`FAIL — ${aspectRatioWarnings.length} warning(s):`)
  for (const w of aspectRatioWarnings) console.log(`  ${w}`)
}

const layoutOk =
  metrics.cardCount > 0 &&
  metrics.cardMetrics.every(
    (c) =>
      c.cardHeight <= 120 &&
      c.sportIconW !== null &&
      c.sportIconW <= 20 &&
      c.sportIconH !== null &&
      c.sportIconH <= 20 &&
      c.sportIconInsideCard,
  )

console.log(`\n=== Layout compact ===`)
console.log(
  layoutOk
    ? 'PASS — sport icons ≤20px, cards ≤120px tall, icons contained'
    : 'FAIL — layout metrics out of range',
)

const allPass = aspectRatioWarnings.length === 0 && layoutOk
console.log(`\n=== Overall: ${allPass ? 'PASS' : 'FAIL'} ===`)
process.exit(allPass ? 0 : 1)
