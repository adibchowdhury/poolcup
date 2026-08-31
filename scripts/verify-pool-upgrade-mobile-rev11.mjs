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
  const crown = sheet?.querySelector('img')
  const features = sheet?.querySelector('ul[aria-label="Premium features"]')
  const cardSection = sheet?.querySelector(
    '[aria-label="Custom Pool purchase"]',
  )
  const card = cardSection?.querySelector(':scope > div')
  const cta = Array.from(sheet?.querySelectorAll('button') ?? []).find((b) =>
    b.textContent?.includes('Upgrade My Pool Experience'),
  )
  const trust = Array.from(sheet?.querySelectorAll('p') ?? []).find(
    (p) =>
      p.textContent?.includes('One-time payment') &&
      p.textContent?.includes('No hidden fees'),
  )
  const cardText = card?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  const fr = features?.getBoundingClientRect()
  const cr = card?.getBoundingClientRect()
  const crownR = crown?.getBoundingClientRect()
  return {
    crownTop: crownR ? Math.round(crownR.top) : null,
    cardWidth: cr ? Math.round(cr.width) : null,
    cardHeight: cr ? Math.round(cr.height) : null,
    ctaWidth: cta ? Math.round(cta.getBoundingClientRect().width) : null,
    featuresToCardGap:
      fr && cr ? Math.round(cr.top - fr.bottom) : null,
    cardHasInternalBenefits: /Keep forever/.test(cardText),
    cardHasPayOnce: /Pay once/.test(cardText),
    trust: trust?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    order: {
      card: cr ? Math.round(cr.top) : null,
      cta: cta ? Math.round(cta.getBoundingClientRect().top) : null,
      trust: trust ? Math.round(trust.getBoundingClientRect().top) : null,
    },
  }
})

const shot = resolve(outDir, 'pool-upgrade-mobile-rev11-390.png')
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
  const text = card?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  return {
    sheetOpen: Boolean(document.querySelector('[data-slot="sheet-content"]')),
    cardHasBenefitsRow: /Keep forever/.test(text),
    benefitsSnippet: text.includes('One-time payment')
      ? text.slice(text.indexOf('One-time payment'))
      : null,
    cardWidth: card ? Math.round(card.getBoundingClientRect().width) : null,
  }
})
await browser.close()

const report = {
  probe,
  desktop,
  shot,
  expected: {
    oldCardWidthApprox: 358,
    newCardWidth: 280,
    stackTopShiftPx: 16,
    featuresToCardGapPx: 24,
  },
}
writeFileSync(
  resolve(outDir, 'pool-upgrade-mobile-rev11-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
