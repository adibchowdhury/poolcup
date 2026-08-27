/**
 * Verify hydration fix + create-pool modal on desktop.
 * Usage: node scripts/verify-hydration-create-modal.mjs
 *        HEADED=1 node scripts/verify-hydration-create-modal.mjs
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
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
const headed = process.env.HEADED === '1'

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
  .limit(1)

if (!members?.length) {
  console.error('No pool members for auth')
  process.exit(1)
}

const { data: userData } = await admin.auth.admin.getUserById(members[0].user_id)
const email = userData?.user?.email
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

const hydrationWarnings = []
const consoleMessages = []

const browser = await chromium.launch({
  headless: !headed,
  channel: headed ? 'chrome' : undefined,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

page.on('console', (msg) => {
  const text = msg.text()
  consoleMessages.push({ type: msg.type(), text })
  if (
    /hydration|did not match|tree will be regenerated/i.test(text) &&
    /MobileBottomNav|mobile-bottom-nav/i.test(text)
  ) {
    hydrationWarnings.push(text)
  }
  if (/hydration|did not match|tree will be regenerated/i.test(text)) {
    hydrationWarnings.push(text)
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

async function hardReloadDashboard() {
  hydrationWarnings.length = 0
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
}

async function openCreateModalFromDashboard() {
  const createBtn = page.getByRole('button', { name: /^create pool$/i }).first()
  await createBtn.click()
  await page.waitForTimeout(400)
}

async function isModalVisible() {
  const dialog = page.getByRole('dialog', { name: /create a pool/i })
  const visible = await dialog.isVisible().catch(() => false)
  if (!visible) return false
  const box = await dialog.boundingBox()
  return Boolean(box && box.width > 100 && box.height > 100)
}

async function readStep1MaskKind() {
  return page.evaluate(() => {
    const shell = document.querySelector(
      '.create-pool-wizard--modal-ticket-shell',
    )
    if (!shell) return { kind: 'missing-shell' }
    const cs = getComputedStyle(shell)
    const mask = cs.maskImage || cs.webkitMaskImage || ''
    if (mask.includes('url(')) return { kind: 'url', prefix: mask.slice(0, 80) }
    if (mask.includes('gradient')) {
      return { kind: 'gradient', layers: mask.split(/,\s*(?![^(]*\))/).length }
    }
    if (!mask || mask === 'none') return { kind: 'none' }
    return { kind: 'other', prefix: mask.slice(0, 80) }
  })
}

async function closeModalIfOpen() {
  const close = page.getByRole('button', { name: /close create pool/i })
  if (await close.isVisible().catch(() => false)) {
    await close.click()
    await page.waitForTimeout(300)
  }
}

await signIn()
await hardReloadDashboard()

console.log('\n=== Hydration (hard reload /dashboard) ===')
console.log(
  hydrationWarnings.length === 0
    ? 'PASS — zero hydration warnings'
    : `FAIL — ${hydrationWarnings.length} warning(s):\n${hydrationWarnings.join('\n')}`,
)

console.log('\n=== Create Pool modal ×10 ===')
let modalPasses = 0
let gradientPasses = 0
for (let i = 0; i < 10; i++) {
  await closeModalIfOpen()
  await openCreateModalFromDashboard()
  await page.waitForTimeout(200)
  const ok = await isModalVisible()
  const mask = await readStep1MaskKind()
  const maskLog = consoleMessages.find((m) =>
    m.text.includes('ticket silhouette first-frame rect'),
  )
  if (ok) modalPasses++
  if (mask.kind === 'gradient') gradientPasses++
  console.log(
    `  click ${i + 1}: ${ok ? 'visible' : 'FAIL'} mask=${mask.kind}${maskLog ? ' (rect logged)' : ''}`,
  )
}

console.log(`\nModal pass rate: ${modalPasses}/10`)
console.log(`Gradient silhouette: ${gradientPasses}/10`)

console.log('\n=== Steps 1-5 navigation ===')
await closeModalIfOpen()
await openCreateModalFromDashboard()
const nextBtn = page.getByRole('button', { name: /^next$/i })
let stepsOk = true
for (let step = 1; step <= 4; step++) {
  if (!(await isModalVisible())) {
    stepsOk = false
    break
  }
  if (await nextBtn.isEnabled().catch(() => false)) {
    await nextBtn.click()
    await page.waitForTimeout(350)
  }
}
stepsOk = stepsOk && (await isModalVisible())
console.log(stepsOk ? 'PASS — modal stayed visible through steps' : 'FAIL — modal lost during steps')

console.log('\n=== Arrival matrix ===')
await closeModalIfOpen()

await page.goto(`${baseUrl}/create`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const afterCreateUrl = page.url()
const createBounceOk = afterCreateUrl.includes('/dashboard')
const createModalOpen = await isModalVisible()
console.log(`/create bounce: url=${afterCreateUrl} bounce=${createBounceOk} modal=${createModalOpen}`)

await closeModalIfOpen()
await page.goto(`${baseUrl}/dashboard?create=stripe-return`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
console.log(`Stripe-return path: url=${page.url()}`)

await browser.close()

const allPass =
  hydrationWarnings.length === 0 &&
  modalPasses === 10 &&
  gradientPasses === 10 &&
  stepsOk &&
  createBounceOk

console.log(`\n=== Overall: ${allPass ? 'PASS' : 'FAIL'} ===`)
process.exit(allPass ? 0 : 1)
