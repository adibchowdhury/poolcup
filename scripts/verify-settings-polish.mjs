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

async function probePolish(page) {
  return page.evaluate(() => {
    const searchInput = document.querySelector(
      'input[aria-label="Search pool settings"]',
    )
    const iconTile = document.querySelector('header .rounded-xl.border')
    const heading = document.querySelector('header h1')
    const outer = document.querySelector('.bg-\\[\\#141414\\]')
    const header = document.querySelector('header')
    const primaryNav = document.querySelector(
      'nav[aria-label="Settings categories"]',
    )
    const contentMax = document.querySelector('.max-w-\\[72rem\\]')
    const mainContent = document.querySelector('main')
    const contentWidth = mainContent ? mainContent.clientWidth : null
    const activePill = document.querySelector(
      '[aria-label*="sections"] button[aria-current="true"], [aria-label*="sections"] button.border-primary\\/45',
    )
    return {
      searchPresent: Boolean(searchInput),
      iconTileSize: iconTile
        ? `${iconTile.offsetWidth}x${iconTile.offsetHeight}`
        : null,
      headingSize: heading
        ? getComputedStyle(heading).fontSize
        : null,
      outerBg: outer ? getComputedStyle(outer).backgroundColor : null,
      headerBg: header ? getComputedStyle(header).backgroundColor : null,
      primaryNavBg: primaryNav
        ? getComputedStyle(primaryNav).backgroundColor
        : null,
      contentMaxWidth: contentMax
        ? getComputedStyle(contentMax).maxWidth
        : null,
      mainContentWidth: contentWidth,
      activePillBg: activePill
        ? getComputedStyle(activePill).backgroundColor
        : null,
      activePillBorder: activePill
        ? getComputedStyle(activePill).borderColor
        : null,
    }
  })
}

async function shot(invite, sectionSlug, navLabel, label, width) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}/pool/${invite}/settings/${sectionSlug}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1200)

  if (navLabel) {
    await page
      .getByRole('button', { name: new RegExp(navLabel, 'i') })
      .first()
      .click()
    await page.waitForTimeout(600)
  }

  const probe = await probePolish(page)
  const path = resolve(
    outDir,
    `settings-polish-${label}-${width}.png`,
  )
  await page.screenshot({ path, fullPage: false })
  await browser.close()
  return { invite, sectionSlug, label, width, path, ...probe }
}

const results = []
results.push(await shot('617c79ba', 'details', null, 'details-1440', 1440))
results.push(await shot('617c79ba', 'danger', 'Danger Zone', 'danger-1440', 1440))
results.push(
  await shot(
    '617c79ba',
    'commissioner',
    'Commissioner Controls',
    'locked-1440',
    1440,
  ),
)
results.push(await shot('617c79ba', 'details', null, 'details-1920', 1920))

writeFileSync(
  resolve(outDir, 'settings-polish-report.json'),
  JSON.stringify(results, null, 2),
)
console.log(JSON.stringify(results, null, 2))
