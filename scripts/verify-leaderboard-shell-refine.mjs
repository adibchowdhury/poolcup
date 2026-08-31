/**
 * Leaderboard shell refine: dimension parity, logo, pool info, CTA sizing.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

dotenv.config({ path: '.env.local' })

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const poolPath = '/pool/afcaad5c?tab=leaderboard'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

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
  if (!verified.data.session) throw new Error(verified.error?.message ?? 'no session')
  const { access_token, refresh_token } = verified.data.session
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
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

function pixelExact(beforePath, afterPath, diffPath) {
  if (!existsSync(beforePath) || !existsSync(afterPath)) return null
  const img1 = PNG.sync.read(readFileSync(beforePath))
  const img2 = PNG.sync.read(readFileSync(afterPath))
  if (img1.width !== img2.width || img1.height !== img2.height) {
    return { error: 'size mismatch' }
  }
  const diff = new PNG({ width: img1.width, height: img1.height })
  const mismatched = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, {
    threshold: 0,
  })
  writeFileSync(diffPath, PNG.sync.write(diff))
  return {
    mismatched,
    total: img1.width * img1.height,
    percent: Number(((mismatched / (img1.width * img1.height)) * 100).toFixed(4)),
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
  const memberId = 'a8a7b220-43d2-4fa0-919e-d7143c6d04cb'

  // Measure dashboard tokens live
  const ctxDash = await browser.newContext()
  await ctxDash.addCookies(await authAs(creatorId))
  const pageDash = await ctxDash.newPage()
  await pageDash.setViewportSize({ width: 1440, height: 900 })
  await pageDash.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 90000 })
  await pageDash.waitForTimeout(800)
  const dashboardMetrics = await pageDash.evaluate(() => {
    const sidebar = document.querySelector('aside[aria-label="Application"]')
    const topBar = document.querySelector('header[aria-label="Page header"]')
    const logo = sidebar?.querySelector('a[aria-label="PoolCup home"]')
    return {
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      sidebarHeight: sidebar ? Math.round(sidebar.getBoundingClientRect().height) : null,
      topBarHeight: topBar ? Math.round(topBar.getBoundingClientRect().height) : null,
      hasLogo: Boolean(logo),
    }
  })
  await ctxDash.close()

  // Leaderboard desktop
  const ctxLb = await browser.newContext()
  await ctxLb.addCookies(await authAs(creatorId))
  const pageLb = await ctxLb.newPage()
  await pageLb.setViewportSize({ width: 1440, height: 900 })
  await pageLb.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await pageLb.waitForTimeout(1500)
  const lb = await pageLb.evaluate(() => {
    const sidebar = document.querySelector('aside[aria-label="Pool navigation and info"]')
    const topBar = document.querySelector('header[aria-label="Pool page header"]')
    const logo = sidebar?.querySelector('a[aria-label="PoolCup home"]')
    const text = sidebar ? (sidebar.textContent || '').replace(/\s+/g, ' ') : ''
    const pucky = sidebar?.querySelector('img[src*="pucky_trophy"]')
    const upgradeBtn = [...(sidebar?.querySelectorAll('button') ?? [])].find((b) =>
      /upgrade to commissioner/i.test(b.textContent || ''),
    )
    const nameEl = [...(sidebar?.querySelectorAll('p') ?? [])].find((p) =>
      /Office World Cup/i.test(p.textContent || ''),
    )
    return {
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      sidebarHeight: sidebar ? Math.round(sidebar.getBoundingClientRect().height) : null,
      topBarHeight: topBar ? Math.round(topBar.getBoundingClientRect().height) : null,
      topBarX: topBar ? Math.round(topBar.getBoundingClientRect().x) : null,
      hasLogo: Boolean(logo),
      logoHref: logo?.getAttribute('href') ?? null,
      hasMembers: /Members/i.test(text),
      hasCreatedBy: /Created by/i.test(text),
      hasPoolType: /Pool Type/i.test(text),
      hasKickoff: /Kickoff/i.test(text),
      hasAvatarInInfo: Boolean(sidebar?.querySelector('[class*="PoolAvatar"], img[alt*="pool" i]')),
      nameWraps: nameEl
        ? getComputedStyle(nameEl).whitespace !== 'nowrap' &&
          !getComputedStyle(nameEl).textOverflow.includes('ellipsis')
        : null,
      nameClass: nameEl?.className ?? null,
      puckySize: pucky
        ? {
            w: Math.round(pucky.getBoundingClientRect().width),
            h: Math.round(pucky.getBoundingClientRect().height),
          }
        : null,
      upgradeBtn: upgradeBtn
        ? {
            width: Math.round(upgradeBtn.getBoundingClientRect().width),
            fontSize: getComputedStyle(upgradeBtn).fontSize,
            text: (upgradeBtn.textContent || '').trim(),
          }
        : null,
      inviteLabel: /Invite members/i.test(text),
      snippet: text.slice(0, 400),
    }
  })
  const shot1440 = resolve(outDir, 'leaderboard-shell-refine-after-1440x900.png')
  await pageLb.screenshot({ path: shot1440, fullPage: false })
  await ctxLb.close()

  // Mobile
  const ctxMobile = await browser.newContext()
  await ctxMobile.addCookies(await authAs(memberId))
  const pageMobile = await ctxMobile.newPage()
  await pageMobile.setViewportSize({ width: 390, height: 844 })
  await pageMobile.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await pageMobile.waitForTimeout(1200)
  const shotMobile = resolve(outDir, 'leaderboard-shell-refine-after-390x844.png')
  await pageMobile.screenshot({ path: shotMobile, fullPage: false })
  await ctxMobile.close()
  await browser.close()

  const beforeMobile = resolve(outDir, 'leaderboard-shell-refine-mobile-before-390x844.png')
  const diffMobile = resolve(outDir, 'leaderboard-shell-refine-mobile-diff.png')
  const mobileDiff = pixelExact(beforeMobile, shotMobile, diffMobile)

  const report = {
    dashboardMetrics,
    leaderboard: lb,
    parity: {
      sidebarWidthMatch: dashboardMetrics.sidebarWidth === lb.sidebarWidth,
      topBarHeightMatch: dashboardMetrics.topBarHeight === lb.topBarHeight,
      sharedTokens:
        'HUB_DESKTOP_SIDEBAR_WIDTH_CLASS (w-[250px]), HUB_DESKTOP_SIDEBAR_CLASS, HUB_DESKTOP_CONTENT_GUTTER_CLASS, h-14',
    },
    shots: { shot1440, shotMobile, diffMobile },
    mobileDiff,
  }
  const reportPath = resolve(outDir, 'leaderboard-shell-refine-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
