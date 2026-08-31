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

async function probeSidebar(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Pool sections"]')
    const items = nav
      ? [...nav.querySelectorAll('button, a')].map((el) =>
          (el.textContent || '').replace(/\s+/g, ' ').trim(),
        )
      : []
    const active = nav?.querySelector('[aria-current="page"]')
    const topBarSettings = [...document.querySelectorAll('header button')].find(
      (b) => /pool settings/i.test(b.getAttribute('aria-label') || b.textContent || ''),
    )
    const topBarActions = [
      ...document.querySelectorAll('header[aria-label="Pool page header"] button'),
    ].map((b) => (b.textContent || '').trim())
    return {
      poolNavItems: items,
      activeNav: active?.textContent?.trim() ?? null,
      topBarSettingsPresent: Boolean(topBarSettings),
      topBarActions,
    }
  })
}

async function shot(path, label) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}${path}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1200)
  const probe = await probeSidebar(page)
  const file = resolve(outDir, `sidebar-settings-nav-${label}-1440.png`)
  await page.screenshot({ path: file, fullPage: false })
  await browser.close()
  return { path, label, file, ...probe }
}

const results = []
results.push(
  await shot(`/pool/${invite}?tab=predictions`, 'predictions'),
)
results.push(await shot(`/pool/${invite}/settings/details`, 'settings-active'))

writeFileSync(
  resolve(outDir, 'sidebar-settings-nav-report.json'),
  JSON.stringify(results, null, 2),
)
console.log(JSON.stringify(results, null, 2))
