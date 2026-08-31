/**
 * Verify pool + dashboard canvas/sidebar colors at 1440px.
 * Run: node scripts/verify-pool-canvas-unification.mjs
 */
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

function rgbToHex(rgb) {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return rgb
  const hex = (n) => Number(n).toString(16).padStart(2, '0')
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`
}

async function probeSurfaces(page) {
  return page.evaluate(() => {
    const hubSidebar = document.querySelector('[data-hub-shell] aside')
    const poolSidebar = document.querySelector('aside[aria-label*="Pool"]')
    const main =
      document.querySelector('main') ??
      document.querySelector('[data-hub-shell] > div')
    const canvas = document.querySelector('[data-hub-shell]') ?? document.body

    function bg(el) {
      if (!el) return null
      const s = getComputedStyle(el)
      return {
        backgroundColor: s.backgroundColor,
        borderRightColor: s.borderRightColor,
      }
    }

    return {
      canvas: bg(canvas),
      main: bg(main),
      hubSidebar: bg(hubSidebar),
      poolSidebar: bg(poolSidebar),
    }
  })
}

const routes = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'pool-home', path: `/pool/${invite}/home` },
  { name: 'pool-predictions', path: `/pool/${invite}?tab=predictions` },
  { name: 'pool-leaderboard', path: `/pool/${invite}?tab=leaderboard` },
  { name: 'pool-settings', path: `/pool/${invite}/settings/details` },
  { name: 'pool-upgrade', path: `/pool/${invite}/upgrade` },
]

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
await context.addCookies(await authAs(creatorId))
const page = await context.newPage()

const report = { desktop: {}, mobile: {} }

for (const route of routes) {
  await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const shot = resolve(outDir, `canvas-unify-${route.name}-1440.png`)
  await page.screenshot({ path: shot, fullPage: false })
  const probes = await probeSurfaces(page)
  report.desktop[route.name] = {
    path: route.path,
    screenshot: shot,
    probes: {
      canvas: rgbToHex(probes.canvas?.backgroundColor ?? ''),
      main: rgbToHex(probes.main?.backgroundColor ?? ''),
      hubSidebar: probes.hubSidebar
        ? rgbToHex(probes.hubSidebar.backgroundColor)
        : null,
      poolSidebar: probes.poolSidebar
        ? rgbToHex(probes.poolSidebar.backgroundColor)
        : null,
    },
  }
  console.log(`[desktop] ${route.name}`, report.desktop[route.name].probes)
}

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
})
await mobileContext.addCookies(await authAs(creatorId))
const mobilePage = await mobileContext.newPage()

for (const route of [
  { name: 'pool-home-mobile', path: `/pool/${invite}?tab=home` },
  { name: 'pool-predictions-mobile', path: `/pool/${invite}?tab=predictions` },
]) {
  await mobilePage.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' })
  await mobilePage.waitForTimeout(600)
  const shot = resolve(outDir, `canvas-unify-${route.name}.png`)
  await mobilePage.screenshot({ path: shot, fullPage: false })
  report.mobile[route.name] = { screenshot: shot }
}

await browser.close()

const reportPath = resolve(outDir, 'canvas-unify-report.json')
writeFileSync(reportPath, JSON.stringify(report, null, 2))
console.log(`Report: ${reportPath}`)
