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

async function shotPool(invite, sectionSlug, navTitle, label, fileSuffix) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}/pool/${invite}/settings/${sectionSlug}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1200)

  if (navTitle !== sectionSlug) {
    await page
      .getByRole('treeitem', { name: new RegExp(navTitle, 'i') })
      .click()
    await page.waitForTimeout(700)
  }

  const probe = await page.evaluate(() => {
    const dialogEl = document.querySelector('[role="dialog"]')
    const settingsAside = document.querySelector(
      'main aside.bg-\\[\\#20221F\\], aside.bg-\\[\\#20221F\\]',
    )
    const aside =
      settingsAside ??
      [...document.querySelectorAll('aside')].find((el) =>
        el.className.includes('20221F'),
      )
    const right = aside?.nextElementSibling
    const locked = [
      ...(document.querySelectorAll(
        '[aria-label*="Custom Pool feature, locked"]',
      ) ?? []),
    ].map((el) => (el.getAttribute('aria-label') || '').slice(0, 90))
    const oldUpgradeCards = [...document.querySelectorAll('button')].filter(
      (b) => /Upgrade this pool — \$9\.99 one-time/i.test(b.textContent || ''),
    ).length
    const quietUpgrades = [...document.querySelectorAll('button')].filter((b) =>
      /Upgrade · \$9\.99 one-time/i.test(b.textContent || ''),
    ).length
    const badges = [...document.querySelectorAll('[data-slot="badge"]')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => /custom pool/i.test(t))
  const settingsNavActive = document.querySelector(
      'nav[aria-label="Pool sections"] [aria-current="page"]',
    )
    return {
      dialogPresent: Boolean(dialogEl),
      settingsNavActive: settingsNavActive?.textContent?.trim() ?? null,
      locked,
      oldUpgradeCards,
      quietUpgrades,
      badges,
      leftBg: aside ? getComputedStyle(aside).backgroundColor : null,
      rightBg: right ? getComputedStyle(right).backgroundColor : null,
    }
  })

  const path = resolve(
    outDir,
    `settings-locked-${label}-${fileSuffix}-1440.png`,
  )
  await page.screenshot({ path, fullPage: false })
  await browser.close()
  return { invite, navTitle, label, path, ...probe }
}

async function shotWorkspace(invite) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}/pool/${invite}/settings/details`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1200)
  const path = resolve(outDir, 'settings-workspace-1440.png')
  await page.screenshot({ path, fullPage: false })
  await browser.close()
  return { path }
}

const results = []
results.push(await shotWorkspace('617c79ba'))
results.push(
  await shotPool(
    '617c79ba',
    'commissioner',
    'Commissioner Controls',
    'basic',
    'commissioner',
  ),
)
results.push(
  await shotPool(
    'afcaad5c',
    'commissioner',
    'Commissioner Controls',
    'custom',
    'commissioner',
  ),
)
results.push(
  await shotPool('617c79ba', 'details', 'Pool Details', 'basic', 'details'),
)

writeFileSync(
  resolve(outDir, 'settings-locked-feature-report.json'),
  JSON.stringify(results, null, 2),
)
console.log(JSON.stringify(results, null, 2))
