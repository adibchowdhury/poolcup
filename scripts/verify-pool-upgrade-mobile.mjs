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
    const crownMobile = document.querySelector(
      'img[src*="crown_mobile"]',
    )
    const desktopCrown = document.querySelector('img[src*="crown.png"]')
    const sparkles = document.querySelectorAll('path[d*="M12 0"]')
    const backLink = Array.from(document.querySelectorAll('button, a')).find(
      (el) => el.textContent?.includes('Back to Pool Settings'),
    )
    const faqPill = Array.from(document.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('I have a question'),
    )
    const cta = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Upgrade My Pool'),
    )
    const scrollEl = sheet?.querySelector('.overflow-y-auto')
    const stackOrder = Array.from(
      sheet?.querySelectorAll('h1, h2, section[aria-label], p, button') ?? [],
    )
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').trim().slice(0, 48),
      }))
      .filter((item) => item.text)

    return {
      sheetOpen: Boolean(sheet),
      crownMobile: Boolean(crownMobile),
      crownMobileW: crownMobile
        ? Math.round(crownMobile.getBoundingClientRect().width)
        : null,
      desktopCrownOnMobile: Boolean(desktopCrown),
      sparkleCount: sparkles.length,
      backLinkVisible: Boolean(backLink),
      faqPillVisible: Boolean(faqPill),
      closeButton: Boolean(
        sheet?.querySelector('button') &&
          sheet.querySelector('.sr-only')?.textContent === 'Close',
      ),
      ctaFullWidth: cta
        ? Math.round(cta.getBoundingClientRect().width)
        : null,
      sheetClientW: sheet
        ? Math.round(sheet.getBoundingClientRect().width)
        : null,
      scrollHeight: scrollEl?.scrollHeight ?? null,
      clientHeight: scrollEl?.clientHeight ?? null,
      stackHeadings: stackOrder.slice(0, 8),
      unlockHeading: Boolean(
        Array.from(document.querySelectorAll('h2')).find((h) =>
          h.textContent?.includes("What You'll Unlock"),
        ),
      ),
      trustLine: Boolean(
        Array.from(document.querySelectorAll('p')).find((p) =>
          p.textContent?.includes('Secure one-time payment'),
        ),
      ),
    }
  })
}

async function openFromLockedSetting(page) {
  await page.goto(
    `${baseUrl}/pool/${invite}?tab=settings&section=commissioner`,
    { waitUntil: 'networkidle', timeout: 90000 },
  )
  await page.waitForTimeout(1500)
  const upgradeLink = page.getByRole('button', {
    name: /Upgrade · \$9\.99 one-time/i,
  })
  await upgradeLink.first().waitFor({ state: 'visible', timeout: 15000 })
  await upgradeLink.first().click()
  await page.waitForTimeout(800)
}

async function openViaQuery(page) {
  await page.goto(
    `${baseUrl}/pool/${invite}?tab=settings&upgrade=1`,
    { waitUntil: 'networkidle', timeout: 90000 },
  )
  await page.waitForTimeout(1500)
}

async function runWidth(width) {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width, height: 844 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()

  await openFromLockedSetting(page)
  let opened = await probe(page)
  if (!opened.sheetOpen) {
    await openViaQuery(page)
    opened = await probe(page)
  }
  const shotOpen = resolve(
    outDir,
    `pool-upgrade-mobile-sheet-${width}-open.png`,
  )
  await page.screenshot({ path: shotOpen, fullPage: false })

  await page.evaluate(() => {
    const scrollEl = document.querySelector(
      '[data-slot="sheet-content"] .overflow-y-auto',
    )
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight
  })
  await page.waitForTimeout(300)
  const scrolled = await probe(page)
  const shotScrolled = resolve(
    outDir,
    `pool-upgrade-mobile-sheet-${width}-scrolled.png`,
  )
  await page.screenshot({ path: shotScrolled, fullPage: false })

  await page
    .locator('[data-slot="sheet-content"]')
    .getByRole('button', { name: 'Close' })
    .click({ timeout: 10000 })
  await page.waitForTimeout(500)
  const afterClose = await page.evaluate(() => ({
    sheetOpen: Boolean(document.querySelector('[data-slot="sheet-content"]')),
    pathname: window.location.pathname,
    search: window.location.search,
  }))

  await page.goto(`${baseUrl}/pool/${invite}/upgrade`, {
    waitUntil: 'networkidle',
  })
  await page.waitForTimeout(800)
  const directUrl = await page.evaluate(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
    sheetOpen: Boolean(document.querySelector('[data-slot="sheet-content"]')),
  }))
  const shotDirect = resolve(
    outDir,
    `pool-upgrade-mobile-direct-${width}.png`,
  )
  await page.screenshot({ path: shotDirect, fullPage: false })

  await browser.close()

  return {
    width,
    opened,
    scrolled,
    afterClose,
    directUrl,
    screenshots: { shotOpen, shotScrolled, shotDirect },
  }
}

async function desktopDiffProof() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}/pool/${invite}/upgrade`, {
    waitUntil: 'networkidle',
  })
  await page.waitForTimeout(800)
  const desktop = await page.evaluate(() => ({
    heading: document.querySelector('h1')?.textContent?.trim(),
    mobileSheet: Boolean(document.querySelector('[data-slot="sheet-content"]')),
    desktopCrown: Boolean(document.querySelector('img[src*="crown.png"]')),
    mobileCrown: Boolean(document.querySelector('img[src*="crown_mobile"]')),
    checkoutCardW: (() => {
      const card = document.querySelector('[aria-label="Custom Pool purchase"]')
      return card ? Math.round(card.getBoundingClientRect().width) : null
    })(),
  }))
  const shot = resolve(outDir, 'pool-upgrade-desktop-diff-proof-1440.png')
  await page.screenshot({ path: shot, fullPage: false })
  await browser.close()
  return { desktop, shot }
}

const results = []
for (const width of [390, 430]) {
  results.push(await runWidth(width))
}
const desktop = await desktopDiffProof()
const report = { mobile: results, desktop }
writeFileSync(
  resolve(outDir, 'pool-upgrade-mobile-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
