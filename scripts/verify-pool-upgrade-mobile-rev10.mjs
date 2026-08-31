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

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
})
await context.addCookies(await authAs(creatorId))
const page = await context.newPage()
await page.goto(`${baseUrl}/pool/${invite}?tab=settings&upgrade=1`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(1200)

const probe = await page.evaluate(() => {
  const sheet = document.querySelector('[data-slot="sheet-content"]')
  const title = Array.from(sheet?.querySelectorAll('h1') ?? []).find((h) =>
    h.textContent?.includes('Premium Features'),
  )
  const titleSpans = title ? Array.from(title.querySelectorAll('span')) : []
  const features = sheet?.querySelector('ul[aria-label="Premium features"]')
  const lastFeatureP = features?.querySelector('li:last-child p')
  const muchMore = lastFeatureP?.querySelector('span')
  const card = sheet?.querySelector('[aria-label="Custom Pool purchase"] > div')
  const cta = Array.from(sheet?.querySelectorAll('button') ?? []).find((b) =>
    b.textContent?.includes('Upgrade My Pool Experience'),
  )
  const reassurance = Array.from(sheet?.querySelectorAll('p') ?? []).find((p) =>
    p.textContent?.includes("You'll keep all"),
  )
  const trust = Array.from(sheet?.querySelectorAll('p') ?? []).find((p) =>
    p.textContent?.includes('One-time payment') &&
      p.textContent?.includes('Secure payment'),
  )
  const cs = (el) => (el ? getComputedStyle(el) : null)
  return {
    titleLines: titleSpans.map((s) => ({
      text: s.textContent?.trim(),
      display: cs(s)?.display,
      whiteSpace: cs(s)?.whiteSpace,
      color: cs(s)?.color,
    })),
    reassurance: reassurance?.textContent?.trim() ?? null,
    trust: trust?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    trustHasShield: trust
      ? Boolean(trust.querySelector('svg'))
      : null,
    cardBg: card ? cs(card)?.backgroundColor : null,
    cardHasGreenEra: card
      ? (cs(card)?.backgroundColor ?? '').includes('0, 168, 93')
      : null,
    muchMore: muchMore
      ? {
          text: muchMore.textContent?.trim(),
          fontFamily: cs(muchMore)?.fontFamily,
          fontSize: cs(muchMore)?.fontSize,
          fontWeight: cs(muchMore)?.fontWeight,
          fontStyle: cs(muchMore)?.fontStyle,
        }
      : null,
    featureFace: lastFeatureP
      ? {
          fontFamily: cs(lastFeatureP)?.fontFamily,
          fontSize: cs(lastFeatureP)?.fontSize,
          fontWeight: cs(lastFeatureP)?.fontWeight,
        }
      : null,
    order: {
      card: card ? Math.round(card.getBoundingClientRect().top) : null,
      reassurance: reassurance
        ? Math.round(reassurance.getBoundingClientRect().top)
        : null,
      cta: cta ? Math.round(cta.getBoundingClientRect().top) : null,
      trust: trust ? Math.round(trust.getBoundingClientRect().top) : null,
    },
  }
})

const shot = resolve(outDir, 'pool-upgrade-mobile-rev10-390.png')
await page.screenshot({ path: shot, fullPage: false })

await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(`${baseUrl}/pool/${invite}/upgrade`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(800)
const desktop = await page.evaluate(() => {
  const card = document.querySelector(
    '[aria-label="Custom Pool purchase"] > div',
  )
  return {
    sheetOpen: Boolean(document.querySelector('[data-slot="sheet-content"]')),
    heading: document.querySelector('h1')?.textContent?.trim(),
    cardBg: card ? getComputedStyle(card).backgroundColor : null,
    cardText: card?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120),
  }
})
await browser.close()

const report = { probe, desktop, shot }
writeFileSync(
  resolve(outDir, 'pool-upgrade-mobile-rev10-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
