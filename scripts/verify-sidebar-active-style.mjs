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

async function probeActive(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const cs = getComputedStyle(el)
    const before = getComputedStyle(el, '::before')
    const svg = el.querySelector('svg')
    return {
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      bg: cs.backgroundColor,
      color: cs.color,
      shadow: cs.boxShadow,
      border: cs.borderColor,
      overflow: cs.overflow,
      beforeContent: before.content,
      beforeWidth: before.width,
      beforeBg: before.backgroundColor,
      svgColor: svg ? getComputedStyle(svg).color : null,
    }
  }, selector)
}

async function main() {
  const cookies = await authCookies()
  const browser = await chromium.launch({ headless: true })

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
    await page.waitForTimeout(2000)
    await page.locator('aside').first().screenshot({
      path: resolve(outDir, 'sidebar-active-pool-1440.png'),
    })
    console.log(
      'pool',
      JSON.stringify(
        await probeActive(
          page,
          '.desktop-sidebar-nav-item[data-state="active"]',
        ),
        null,
        2,
      ),
    )
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
    await page.waitForTimeout(2000)
    await page.locator('aside').first().screenshot({
      path: resolve(outDir, 'sidebar-active-hub-1440.png'),
    })
    console.log(
      'hub',
      JSON.stringify(
        await probeActive(
          page,
          'aside a.desktop-sidebar-nav-item[aria-current="page"], aside a.desktop-sidebar-nav-active',
        ),
        null,
        2,
      ),
    )
    await ctx.close()
  }

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
