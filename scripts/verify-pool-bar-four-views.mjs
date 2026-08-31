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

function probeBar(page) {
  return page.evaluate(() => {
    const headers = Array.from(
      document.querySelectorAll('header[aria-label*="Pool"]'),
    )
    const visible = headers.filter((h) => {
      const style = getComputedStyle(h)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
    const bar = visible[0] ?? headers[0]
    const h1 = bar?.querySelector('h1')
    const gear = bar?.querySelector('svg.lucide-settings')
    const avatar = bar?.querySelector('img')
    const report = bar?.querySelector('button[aria-label="Report issue"]')
    const invite = Array.from(bar?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('Invite'),
    )
    const backUpgrade = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Back to Pool Settings'),
    )
    return {
      barCount: headers.length,
      visibleBarCount: visible.length,
      ariaLabel: bar?.getAttribute('aria-label') ?? null,
      h1: h1?.textContent?.trim() ?? null,
      hasGear: Boolean(gear),
      hasAvatar: Boolean(avatar),
      reportPresent: Boolean(report),
      invitePresent: Boolean(invite),
      upgradeBackLink: Boolean(backUpgrade),
    }
  })
}

async function capture(view, width) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()

  if (view === 'predictions') {
    await page.goto(`${baseUrl}/pool/${invite}?tab=predictions`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
  } else if (view === 'leaderboard') {
    await page.goto(`${baseUrl}/pool/${invite}?tab=predictions`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await page.getByRole('tab', { name: 'Leaderboard' }).click()
    await page.waitForTimeout(700)
  } else if (view === 'settings') {
    await page.goto(`${baseUrl}/pool/${invite}?tab=predictions`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await page.getByRole('tab', { name: 'Settings' }).click()
    await page.waitForTimeout(900)
  } else if (view === 'upgrade') {
    await page.goto(`${baseUrl}/pool/${invite}/upgrade`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await page.waitForTimeout(900)
  }

  const probe = await probeBar(page)
  const path = resolve(outDir, `pool-bar-${view}-1440.png`)
  await page.screenshot({ path, fullPage: false, clip: { x: 0, y: 0, width, height: 220 } })
  await browser.close()
  return { view, width, path, ...probe }
}

const results = []
for (const view of ['predictions', 'leaderboard', 'settings', 'upgrade']) {
  results.push(await capture(view, 1440))
}

writeFileSync(
  resolve(outDir, 'pool-bar-four-views-report.json'),
  JSON.stringify(results, null, 2),
)
console.log(JSON.stringify(results, null, 2))
