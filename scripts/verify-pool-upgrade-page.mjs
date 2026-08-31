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

async function capture(label, width) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}/pool/${invite}/upgrade`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1200)

  const probe = await page.evaluate(() => ({
    pathname: window.location.pathname,
    heading: document.querySelector('h1')?.textContent?.trim(),
    price: document.body.textContent?.includes('$9.99'),
    cta: Boolean(
      Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Upgrade My Pool'),
      ),
    ),
    backLink: Boolean(
      Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Back to Pool Settings'),
      ),
    ),
    questionPill: Boolean(
      Array.from(document.querySelectorAll('a')).find((a) =>
        a.textContent?.includes('I have a question'),
      ),
    ),
    questionPillHref: Array.from(document.querySelectorAll('a'))
      .find((a) => a.textContent?.includes('I have a question'))
      ?.getAttribute('href'),
    sharedTopBarRemoved: !document.querySelector(
      'header[aria-label="Pool page header"]',
    ),
    sidebar: Boolean(document.querySelector('aside[aria-label*="Pool"]')),
    puckyHeroRemoved: !document.querySelector('img[src*="pucky_upgrade"]'),
    crown: Boolean(document.querySelector('img[src*="crown"]')),
    checkoutCardW: (() => {
      const card = document.querySelector('[aria-label="Custom Pool purchase"]')
      if (!card) return null
      return Math.round(card.getBoundingClientRect().width)
    })(),
    heroToCardGap: (() => {
      const card = document.querySelector('[aria-label="Custom Pool purchase"]')
      const hero = document.querySelector('img[src*="crown"]')?.closest('.relative.flex')
      if (!card || !hero) return null
      return Math.round(
        card.getBoundingClientRect().top - hero.getBoundingClientRect().bottom,
      )
    })(),
    featuresPanelH: (() => {
      const panel = document.querySelector('aside[aria-label*="unlock" i]')
      if (!panel) return null
      return Math.round(panel.getBoundingClientRect().height)
    })(),
    leftColumnH: (() => {
      const card = document.querySelector('[aria-label="Custom Pool purchase"]')
      const col = card?.closest('.flex.min-h-0.min-w-0.flex-col')
      if (!col) return null
      return Math.round(col.getBoundingClientRect().height)
    })(),
    columnHeightsMatch: (() => {
      const panel = document.querySelector('aside[aria-label*="unlock" i]')
      const card = document.querySelector('[aria-label="Custom Pool purchase"]')
      const col = card?.closest('.flex.min-h-0.min-w-0.flex-col')
      if (!panel || !col) return null
      return (
        Math.abs(
          panel.getBoundingClientRect().height - col.getBoundingClientRect().height,
        ) <= 2
      )
    })(),
    cardToCtaGap: (() => {
      const card = document.querySelector('[aria-label="Custom Pool purchase"]')
      const cta = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Upgrade My Pool'),
      )
      if (!card || !cta) return null
      return Math.round(
        cta.getBoundingClientRect().top - card.getBoundingClientRect().bottom,
      )
    })(),
    cardToTrustGap: (() => {
      const card = document.querySelector('[aria-label="Custom Pool purchase"]')
      const trust = Array.from(document.querySelectorAll('p')).find((p) =>
        p.textContent?.includes('Secure one-time payment'),
      )
      if (!card || !trust) return null
      return Math.round(
        trust.getBoundingClientRect().top - card.getBoundingClientRect().bottom,
      )
    })(),
    trustToCtaGap: (() => {
      const trust = Array.from(document.querySelectorAll('p')).find((p) =>
        p.textContent?.includes('Secure one-time payment'),
      )
      const cta = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Upgrade My Pool'),
      )
      if (!trust || !cta) return null
      return Math.round(
        cta.getBoundingClientRect().top - trust.getBoundingClientRect().bottom,
      )
    })(),
    ctaToReassuranceGap: (() => {
      const cta = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Upgrade My Pool'),
      )
      const reassurance = Array.from(document.querySelectorAll('p')).find(
        (p) =>
          p.textContent?.includes('keep all your current members') ?? false,
      )
      if (!cta || !reassurance) return null
      return Math.round(
        reassurance.getBoundingClientRect().top - cta.getBoundingClientRect().bottom,
      )
    })(),
    purchaseColumnTop: (() => {
      const crown = document.querySelector('img[src*="crown"]')
      if (!crown) return null
      return Math.round(crown.getBoundingClientRect().top)
    })(),
    crownPx: (() => {
      const img = document.querySelector('img[src*="crown"]')
      if (!img) return 0
      const r = img.getBoundingClientRect()
      return Math.round(Math.max(r.width, r.height))
    })(),
    compositionMaxW: (() => {
      const grid = document.querySelector(
        '[style*="max-width: 1120px"], [style*="max-width:1120px"]',
      )
      if (!grid) {
        const fallback = document.querySelector('[aria-label="Custom Pool purchase"]')
          ?.closest('.mx-auto.grid')
        if (!fallback) return null
        return Math.round(fallback.getBoundingClientRect().width)
      }
      return Math.round(grid.getBoundingClientRect().width)
    })(),
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    sparkleCount: document.querySelectorAll(
      'svg path[d*="M12 0 L14.4"]',
    ).length,
    reportIssueCount: Array.from(document.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Report issue',
    ).length,
    benefitsRow: document.body.textContent?.includes('One-time payment'),
    unlockPanel: Boolean(
      document.querySelector('aside[aria-label*="unlock" i]'),
    ),
  }))

  const path = resolve(outDir, `pool-upgrade-${label}-${width}.png`)
  await page.screenshot({ path, fullPage: false })
  await browser.close()
  return { label, width, path, ...probe }
}

const results = []
results.push(await capture('from-locked', 1440))
results.push(await capture('from-locked', 1920))

writeFileSync(
  resolve(outDir, 'pool-upgrade-report.json'),
  JSON.stringify(results, null, 2),
)
console.log(JSON.stringify(results, null, 2))
