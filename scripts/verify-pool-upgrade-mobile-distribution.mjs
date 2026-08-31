import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })
const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
const invite = '617c79ba'

async function authAs(userId) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: got, error } = await admin.auth.admin.getUserById(userId)
  if (error || !got.user?.email) throw new Error(error?.message ?? 'no user')
  const user = got.user
  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  })
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const verified = await anon.auth.verifyOtp({
    email: user.email,
    token: link.data.properties.email_otp,
    type: 'email',
  })
  if (!verified.data.session) {
    throw new Error(verified.error?.message ?? 'no session')
  }
  const { access_token, refresh_token } = verified.data.session
  const projectRef = new URL(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ).hostname.split('.')[0]
  return [
    {
      name: `sb-${projectRef}-auth-token`,
      value: JSON.stringify({
        access_token,
        refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: user.id,
          email: user.email,
          aud: user.aud,
          role: user.role,
          app_metadata: user.app_metadata ?? {},
          user_metadata: user.user_metadata ?? {},
        },
      }),
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]
}

async function probe(page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-slot="sheet-content"]')
    const scrollEl = sheet?.querySelector('.overflow-y-auto')
    const stack = scrollEl?.querySelector('.min-h-\\[100dvh\\]')
    const spacers = stack?.querySelectorAll('[aria-hidden].flex-1') ?? []
    const crown = document.querySelector('img[src*="crown_mobile"]')
    const title = Array.from(document.querySelectorAll('h1')).find((h) =>
      h.textContent?.includes('Premium Features'),
    )
    const sparkles = scrollEl?.querySelectorAll('svg path[d*="M12 0"]') ?? []
    const crownRect = crown?.getBoundingClientRect()
    const titleRect = title?.getBoundingClientRect()
    let sparklesOverlapCrown = false
    sparkles.forEach((path) => {
      const svg = path.closest('svg')
      const r = svg?.getBoundingClientRect()
      if (!r || !crownRect) return
      const overlap =
        r.left < crownRect.right &&
        r.right > crownRect.left &&
        r.top < crownRect.bottom &&
        r.bottom > crownRect.top
      if (overlap) sparklesOverlapCrown = true
    })
    return {
      sheetH: sheet ? Math.round(sheet.getBoundingClientRect().height) : null,
      scrollHeight: scrollEl?.scrollHeight ?? null,
      clientHeight: scrollEl?.clientHeight ?? null,
      scrollable: scrollEl
        ? scrollEl.scrollHeight > scrollEl.clientHeight + 2
        : null,
      stackMinH100dvh: Boolean(stack),
      flexSpacerCount: spacers.length,
      sparklesInTitleZone:
        titleRect &&
        Array.from(sparkles).every((path) => {
          const svg = path.closest('svg')
          const r = svg?.getBoundingClientRect()
          if (!r || !titleRect) return true
          const cy = r.top + r.height / 2
          return cy >= titleRect.top - 24 && cy <= titleRect.bottom + 24
        }),
      sparklesOverlapCrown,
      sparkleCount: sparkles.length,
    }
  })
}

async function capture(label, width, height) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width, height },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}/pool/${invite}?tab=settings&upgrade=1`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1200)
  const metrics = await probe(page)
  const shot = resolve(outDir, `pool-upgrade-mobile-${label}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  await browser.close()
  return { label, width, height, metrics, shot }
}

async function desktopProof() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}/pool/${invite}/upgrade`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1000)
  const proof = await page.evaluate(() => ({
    sheetOpen: Boolean(document.querySelector('[data-slot="sheet-content"]')),
    heading: document.querySelector('h1')?.textContent?.trim(),
  }))
  await browser.close()
  return proof
}

const tall = await capture('390x844', 390, 844)
const short = await capture('390x700', 390, 700)
const desktop = await desktopProof()

const ok =
  !desktop.sheetOpen &&
  desktop.heading === 'Upgrade Your Pool' &&
  tall.metrics.stackMinH100dvh &&
  tall.metrics.flexSpacerCount === 4 &&
  !tall.metrics.sparklesOverlapCrown &&
  tall.metrics.sparklesInTitleZone &&
  !tall.metrics.scrollable &&
  short.metrics.scrollable

const report = { ok, tall, short, desktop }
writeFileSync(
  resolve(outDir, 'pool-upgrade-mobile-distribution-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
if (!ok) process.exit(1)
