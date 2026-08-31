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

async function probeTopBar(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('header[aria-label*="Pool"]')
    const h1 = bar?.querySelector('h1')
    const gear = bar?.querySelector('svg.lucide-settings')
    const avatar = bar?.querySelector('img, [data-pool-avatar]')
    const meta = bar?.querySelector('.mt-1')
    const workspaceHeader = document.querySelector(
      '.bg-\\[\\#141414\\] > header',
    )
    const reportBtn = bar?.querySelector('button[aria-label="Report issue"]')
    const inviteBtn = Array.from(bar?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.includes('Invite'),
    )
    return {
      barPresent: Boolean(bar),
      h1Text: h1?.textContent?.trim() ?? null,
      h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
      hasGearIcon: Boolean(gear),
      hasAvatar: Boolean(avatar),
      metaText: meta?.textContent?.trim().replace(/\s+/g, ' ') ?? null,
      duplicateWorkspaceHeader: Boolean(workspaceHeader),
      reportPresent: Boolean(reportBtn),
      invitePresent: Boolean(inviteBtn),
    }
  })
}

async function capture(label, width, tabName) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}/pool/${invite}?tab=predictions`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1000)

  if (tabName === 'Leaderboard') {
    await page.getByRole('tab', { name: 'Leaderboard' }).click()
    await page.waitForTimeout(600)
  } else if (tabName === 'Settings') {
    await page.getByRole('tab', { name: 'Settings' }).click()
    await page.waitForTimeout(800)
  }

  const probe = await probeTopBar(page)
  const path = resolve(outDir, `pool-topbar-${label}-${width}.png`)
  await page.screenshot({ path, fullPage: false, clip: { x: 0, y: 0, width, height: 220 } })
  await browser.close()
  return { label, width, tabName, path, ...probe }
}

async function captureMobileSettingsTab() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}/pool/${invite}?tab=settings`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1000)
  const probe = await page.evaluate(() => ({
    desktopBarVisible: Boolean(
      document.querySelector('header[aria-label*="Pool page header"]')?.offsetParent ||
        document.querySelector('header[aria-label*="Pool settings header"]')?.offsetParent,
    ),
    desktopBarDisplay: document.querySelector('header[aria-label*="Pool"]')
      ? getComputedStyle(document.querySelector('header[aria-label*="Pool"]')).display
      : null,
    mobileTabBar: Boolean(document.querySelector('[role="tablist"]')),
  }))
  const path = resolve(outDir, 'pool-topbar-mobile-settings-390.png')
  await page.screenshot({ path, fullPage: false })
  await browser.close()
  return { label: 'mobile-settings', width: 390, path, ...probe }
}

const results = []
results.push(await capture('predictions', 1440, 'Predictions'))
results.push(await capture('leaderboard', 1440, 'Leaderboard'))
results.push(await capture('settings', 1440, 'Settings'))
results.push(await captureMobileSettingsTab())

writeFileSync(
  resolve(outDir, 'pool-topbar-variants-report.json'),
  JSON.stringify(results, null, 2),
)
console.log(JSON.stringify(results, null, 2))
