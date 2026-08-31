import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })

const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })
const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'

async function authCookies() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: got, error } = await admin.auth.admin.getUserById(creatorId)
  if (error || !got.user?.email) throw new Error(error?.message ?? 'no user')
  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: got.user.email,
  })
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const verified = await anon.auth.verifyOtp({
    email: got.user.email,
    token: link.data.properties.email_otp,
    type: 'email',
  })
  if (!verified.data.session)
    throw new Error(verified.error?.message ?? 'no session')
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
          id: got.user.id,
          email: got.user.email,
          aud: got.user.aud,
          role: got.user.role,
          app_metadata: got.user.app_metadata ?? {},
          user_metadata: got.user.user_metadata ?? {},
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

async function measureActive(page) {
  return page.evaluate(() => {
    const el =
      document.querySelector('.desktop-sidebar-nav-item[data-state="active"]') ||
      document.querySelector(
        'aside a.desktop-sidebar-nav-item[aria-current="page"]',
      ) ||
      document.querySelector('aside a.desktop-sidebar-nav-active')
    if (!el) return { error: 'no active item' }
    const item = el.getBoundingClientRect()
    const svg = el.querySelector('svg')
    const icon = svg?.getBoundingClientRect()
    const before = getComputedStyle(el, '::before')
    const cs = getComputedStyle(el)
    const barW = parseFloat(before.width) || 0
    const barLeftOffset = parseFloat(before.left) || 0
    const bar = {
      left: item.left + barLeftOffset,
      right: item.left + barLeftOffset + barW,
      width: barW,
      cssLeft: before.left,
    }
    const gap = icon ? icon.left - bar.right : null
    return {
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48),
      paddingLeft: cs.paddingLeft,
      bar,
      iconLeft: icon?.left ?? null,
      gapPx: gap,
      overlaps: gap != null ? gap < 8 : null,
    }
  })
}

async function shotAside(page, name) {
  await page.locator('aside').first().screenshot({
    path: resolve(outDir, name),
  })
}

async function main() {
  const cookies = await authCookies()
  const browser = await chromium.launch({ headless: true })
  const report = {}

  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    await ctx.addCookies(cookies)
    const page = await ctx.newPage()
    await page.goto(`${baseUrl}/pool/afcaad5c?tab=leaderboard`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await page.waitForTimeout(1500)
    report.poolLeaderboard = await measureActive(page)
    await shotAside(page, 'sidebar-clear-pool-leaderboard-1440.png')

    await page.getByRole('tab', { name: /Predictions/i }).click()
    await page.waitForTimeout(600)
    report.poolPredictions = await measureActive(page)
    await shotAside(page, 'sidebar-clear-pool-predictions-1440.png')
    await ctx.close()
  }

  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    await ctx.addCookies(cookies)
    const page = await ctx.newPage()
    await page.goto(`${baseUrl}/dashboard`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await page.waitForTimeout(1500)
    report.hubHome = await measureActive(page)
    await shotAside(page, 'sidebar-clear-hub-home-1440.png')

    for (const { label, pathHint } of [
      { label: 'Matches', pathHint: 'games' },
      { label: 'Friends', pathHint: 'friends' },
      { label: 'Discover', pathHint: 'discover' },
      { label: 'Profile', pathHint: 'u/' },
      { label: 'Chat', pathHint: 'chat' },
    ]) {
      await page.getByRole('link', { name: new RegExp(`^${label}`) }).click()
      await page.waitForTimeout(1200)
      report[`hub${label}`] = await measureActive(page)
      await shotAside(
        page,
        `sidebar-clear-hub-${label.toLowerCase()}-1440.png`,
      )
    }
    await ctx.close()
  }

  console.log(JSON.stringify(report, null, 2))
  const bad = Object.entries(report).filter(
    ([, v]) => v && (v.overlaps || (v.gapPx != null && v.gapPx < 8)),
  )
  if (bad.length) {
    console.error(
      'OVERLAP/TOO-TIGHT:',
      bad.map(([k, v]) => `${k}: gap=${v.gapPx}`),
    )
    process.exitCode = 1
  }
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
