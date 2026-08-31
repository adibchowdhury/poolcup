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
  const features = sheet?.querySelector('ul[aria-label="Premium features"]')
  const lastFeature = features?.querySelector('li:last-child')?.textContent
  const card = sheet?.querySelector('[aria-label="Custom Pool purchase"] > div')
  const cardText = card?.textContent ?? ''
  const price = Array.from(card?.querySelectorAll('p') ?? []).find((p) =>
    p.textContent?.includes('$9.99'),
  )
  const sentence = Array.from(card?.querySelectorAll('p') ?? []).find((p) =>
    p.textContent?.includes('Pay once'),
  )
  const cta = Array.from(sheet?.querySelectorAll('button') ?? []).find((b) =>
    b.textContent?.includes('Upgrade My Pool'),
  )
  const cs = (el) => (el ? getComputedStyle(el) : null)
  const cardCs = cs(card)
  const priceRect = price?.getBoundingClientRect()
  const sentenceRect = sentence?.getBoundingClientRect()
  const cardRect = card?.getBoundingClientRect()
  const ctaRect = cta?.getBoundingClientRect()
  return {
    lastFeatureInline: lastFeature?.replace(/\s+/g, ' ').trim(),
    oneTimeGone: !cardText.includes('one-time'),
    pricePresent: cardText.includes('$9.99'),
    priceToSentenceGap:
      priceRect && sentenceRect
        ? Math.round(sentenceRect.top - priceRect.bottom)
        : null,
    cardShadow: cardCs?.boxShadow,
    cardToCtaGap:
      cardRect && ctaRect
        ? Math.round(ctaRect.top - cardRect.bottom)
        : null,
    ctaText: cta?.textContent?.trim(),
    glowClass: sheet
      ?.querySelector('[aria-hidden].absolute.inset-x-0')
      ?.className.includes('0.24'),
  }
})

const shot = resolve(outDir, 'pool-upgrade-mobile-rev8-390.png')
await page.screenshot({ path: shot, fullPage: false })

await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(`${baseUrl}/pool/${invite}/upgrade`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(800)
const desktop = await page.evaluate(() => ({
  sheetOpen: Boolean(document.querySelector('[data-slot="sheet-content"]')),
  heading: document.querySelector('h1')?.textContent?.trim(),
}))
await browser.close()

const report = { probe, desktop, shot }
writeFileSync(
  resolve(outDir, 'pool-upgrade-mobile-rev8-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
