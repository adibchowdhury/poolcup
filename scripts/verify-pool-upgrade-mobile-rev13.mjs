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

async function probeAt(page, width, height) {
  await page.setViewportSize({ width, height })
  await page.goto(`${baseUrl}/pool/${invite}?tab=settings&upgrade=1`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1000)

  return page.evaluate(({ height: vh }) => {
    const sheet = document.querySelector('[data-slot="sheet-content"]')
    const closeCandidates = Array.from(sheet?.querySelectorAll('button') ?? [])
    const closeEl =
      closeCandidates.find((b) => {
        const s = getComputedStyle(b)
        return s.position === 'absolute' && !b.textContent?.includes('Upgrade')
      }) ?? null
    const title = sheet?.querySelector('h1')
    const features = sheet?.querySelector('ul[aria-label="Premium features"]')
    const featureItems = Array.from(features?.querySelectorAll('li') ?? []).map(
      (li) => li.textContent?.replace(/\s+/g, ' ').trim(),
    )
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
    const reassurance = Array.from(sheet?.querySelectorAll('p') ?? []).find(
      (p) => p.textContent?.includes("You'll keep all"),
    )
    const crown = sheet?.querySelector('img')
    const cs = (el) => (el ? getComputedStyle(el) : null)
    const vis = (el) => {
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.top >= -1 && r.bottom <= vh + 1 && r.height > 0
    }
    const titleR = title?.getBoundingClientRect()
    const featR = features?.getBoundingClientRect()
    const cardR = card?.getBoundingClientRect()
    const ctaR = cta?.getBoundingClientRect()
    const trustR = trust?.getBoundingClientRect()
    const reasR = reassurance?.getBoundingClientRect()
    const crownR = crown?.getBoundingClientRect()
    const contentBottom = Math.max(
      trustR?.bottom ?? 0,
      ctaR?.bottom ?? 0,
      cardR?.bottom ?? 0,
    )
    return {
      viewport: { width: window.innerWidth, height: vh },
      crown: {
        top: crownR ? Math.round(crownR.top) : null,
        width: crownR ? Math.round(crownR.width) : null,
        height: crownR ? Math.round(crownR.height) : null,
      },
      crownToTitleGap:
        crownR && titleR ? Math.round(titleR.top - crownR.bottom) : null,
      featureItems,
      featureCount: featureItems.length,
      titleToFeaturesGap:
        titleR && featR ? Math.round(featR.top - titleR.bottom) : null,
      featuresToCardGap:
        featR && cardR ? Math.round(cardR.top - featR.bottom) : null,
      bottomGaps: {
        reassuranceToCta:
          reasR && ctaR ? Math.round(ctaR.top - reasR.bottom) : null,
        ctaToTrust:
          ctaR && trustR ? Math.round(trustR.top - ctaR.bottom) : null,
      },
      cardWidth: cardR ? Math.round(cardR.width) : null,
      ctaWidth: ctaR ? Math.round(ctaR.width) : null,
      overflowY: sheet ? cs(sheet)?.overflowY : null,
      scrollable:
        sheet != null && sheet.scrollHeight > sheet.clientHeight + 1,
      contentBottom: Math.round(contentBottom),
      clippedBelowFold: contentBottom > vh + 1,
      visible: {
        crown: vis(crown),
        title: vis(title),
        features: vis(features),
        card: vis(card),
        cta: vis(cta),
        trust: vis(trust),
      },
      allVisible:
        vis(crown) &&
        vis(title) &&
        vis(features) &&
        vis(card) &&
        vis(cta) &&
        vis(trust),
    }
  }, { height })
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
await context.addCookies(await authAs(creatorId))
const page = await context.newPage()

const at844 = await probeAt(page, 390, 844)
const shot844 = resolve(outDir, 'pool-upgrade-mobile-rev13-390x844.png')
await page.screenshot({ path: shot844, fullPage: false })

const at700 = await probeAt(page, 390, 700)
const shot700 = resolve(outDir, 'pool-upgrade-mobile-rev13-390x700.png')
await page.screenshot({ path: shot700, fullPage: false })

await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(`${baseUrl}/pool/${invite}/upgrade`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(800)
const desktop = await page.evaluate(() => ({
  sheetOpen: Boolean(document.querySelector('[data-slot="sheet-content"]')),
  cardHasBenefitsRow: /Keep forever/.test(
    document
      .querySelector('[aria-label="Custom Pool purchase"]')
      ?.textContent?.replace(/\s+/g, ' ') ?? '',
  ),
}))

await browser.close()

const report = {
  at844,
  at700,
  shots: { shot844, shot700 },
  desktop,
  expected: {
    crownWas: { width: 200, height: 133, top: 12 },
    crownNow: { width: 224, heightApprox: 149, top: 20 },
    crownToTitleWas: 12,
    crownToTitleNow: 20,
    bottomGapWas: 8,
    bottomGapNow: 16,
    fifthFeature: {
      id: 'missing_predictions',
      title: 'Prediction Tracking',
      icon: 'UserX',
    },
  },
}
writeFileSync(
  resolve(outDir, 'pool-upgrade-mobile-rev13-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
