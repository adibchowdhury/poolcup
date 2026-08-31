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

function probeUpgrade(page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-slot="sheet-content"]')
    const crownMobile = Boolean(
      document.querySelector('img[src*="crown_mobile"]'),
    )
    const desktopCrown = Boolean(
      document.querySelector('img[src*="crown.png"]'),
    )
    const heading = document.querySelector('h1')?.textContent?.trim() ?? null
    return {
      pathname: window.location.pathname,
      search: window.location.search,
      sheetOpen: Boolean(sheet),
      crownMobile,
      desktopCrown,
      heading,
      faqPill: Boolean(
        Array.from(document.querySelectorAll('a')).find((a) =>
          a.textContent?.includes('I have a question'),
        ),
      ),
    }
  })
}

async function clickFirstUpgradeEntry(page) {
  const locked = page.getByRole('button', {
    name: /Upgrade · \$9\.99 one-time/i,
  })
  if ((await locked.count()) > 0) {
    await locked.first().click()
    return 'locked-link'
  }
  const sidebar = page.getByRole('button', {
    name: /Upgrade to Custom Pool/i,
  })
  if ((await sidebar.count()) > 0) {
    await sidebar.first().click()
    return 'sidebar-cta'
  }
  return null
}

async function runDesktop() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()

  // Entry: settings locked link → must land on /upgrade page, no sheet
  await page.goto(
    `${baseUrl}/pool/${invite}/settings/commissioner`,
    { waitUntil: 'networkidle', timeout: 90000 },
  )
  await page.waitForTimeout(1200)
  const entry = await clickFirstUpgradeEntry(page)
  await page.waitForTimeout(1500)
  const fromSettings = await probeUpgrade(page)
  const shotSettings = resolve(
    outDir,
    'pool-upgrade-branch-desktop-1440-from-settings.png',
  )
  await page.screenshot({ path: shotSettings, fullPage: false })

  // Entry: pool page sidebar CTA
  await page.goto(`${baseUrl}/pool/${invite}?tab=settings`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1200)
  const sidebarEntry = await clickFirstUpgradeEntry(page)
  await page.waitForTimeout(1500)
  const fromSidebar = await probeUpgrade(page)

  // Direct URL
  await page.goto(`${baseUrl}/pool/${invite}/upgrade`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1200)
  const direct = await probeUpgrade(page)
  const shotDirect = resolve(
    outDir,
    'pool-upgrade-branch-desktop-1440-direct.png',
  )
  await page.screenshot({ path: shotDirect, fullPage: false })

  await browser.close()
  return {
    entry,
    sidebarEntry,
    fromSettings,
    fromSidebar,
    direct,
    shots: { shotSettings, shotDirect },
  }
}

async function runMobile() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()

  await page.goto(
    `${baseUrl}/pool/${invite}?tab=settings&section=commissioner`,
    { waitUntil: 'networkidle', timeout: 90000 },
  )
  await page.waitForTimeout(1500)
  const entry = await clickFirstUpgradeEntry(page)
  await page.waitForTimeout(1000)
  let fromLocked = await probeUpgrade(page)
  if (!fromLocked.sheetOpen) {
    await page.goto(
      `${baseUrl}/pool/${invite}?tab=settings&upgrade=1`,
      { waitUntil: 'networkidle', timeout: 90000 },
    )
    await page.waitForTimeout(1000)
    fromLocked = await probeUpgrade(page)
  }
  const shotLocked = resolve(
    outDir,
    'pool-upgrade-branch-mobile-390-from-locked.png',
  )
  await page.screenshot({ path: shotLocked, fullPage: false })

  await page.goto(`${baseUrl}/pool/${invite}/upgrade`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1500)
  const direct = await probeUpgrade(page)
  const shotDirect = resolve(
    outDir,
    'pool-upgrade-branch-mobile-390-direct.png',
  )
  await page.screenshot({ path: shotDirect, fullPage: false })

  await browser.close()
  return { entry, fromLocked, direct, shots: { shotLocked, shotDirect } }
}

const desktop = await runDesktop()
const mobile = await runMobile()

const ok =
  !desktop.fromSettings.sheetOpen &&
  !desktop.fromSidebar.sheetOpen &&
  !desktop.direct.sheetOpen &&
  desktop.direct.pathname.includes('/upgrade') &&
  desktop.direct.desktopCrown &&
  !desktop.direct.crownMobile &&
  mobile.fromLocked.sheetOpen &&
  mobile.fromLocked.crownMobile &&
  mobile.direct.sheetOpen &&
  mobile.direct.search.includes('upgrade=1')

const report = { ok, desktop, mobile }
writeFileSync(
  resolve(outDir, 'pool-upgrade-branch-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
if (!ok) process.exit(1)
