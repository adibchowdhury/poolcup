/**
 * Leaderboard shell revision verification + screenshots.
 * Auth as pool creator (Pucky) so Commissioner upsell is visible when Basic.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

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
  console.log('authing as', user.email)
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

async function probe(page, viewport, label) {
  await page.setViewportSize(viewport)
  await page.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1500)

  const data = await page.evaluate(() => {
    const sidebar = document.querySelector('aside[aria-label="Pool navigation and info"]')
    const sc = sidebar ? getComputedStyle(sidebar) : null
    const text = sidebar ? (sidebar.textContent || '').replace(/\s+/g, ' ') : ''
    const topBarH1 = document.querySelector('header h1.font-display')
    const separatePageHeader = document.querySelector('h1.font-display.text-3xl')
    const upsell = [...document.querySelectorAll('button')].find((b) =>
      /upgrade to commissioner/i.test(b.textContent || ''),
    )
    const activityLabel = text.includes('Recent activity')
    const kickoff = /Next kickoff/i.test(text)
    const inviteInSidebar = /Invite members/i.test(text)
    const mobileTabs = document.querySelector('.lg\\:hidden .grid-cols-3, .lg\\:hidden [role="tablist"]')
    return {
      url: location.pathname + location.search,
      sidebar: sidebar
        ? {
            display: sc.display,
            width: Math.round(sidebar.getBoundingClientRect().width),
            visible: sc.display !== 'none' && sidebar.getBoundingClientRect().width > 0,
            hasPool: /PoolPredictionsLeaderboard/i.test(text.replace(/\s/g, '')),
            hasPoolInfo: /Pool info/i.test(text),
            hasActivity: activityLabel,
            hasKickoff: kickoff,
            hasInvite: inviteInSidebar,
            hasUpsell: /Make your pool standout/i.test(text),
            memberCountMatch: /15 members/.test(text),
            snippet: text.slice(0, 280),
          }
        : { present: false },
      topBarTitle: topBarH1?.textContent?.trim()?.slice(0, 80) ?? null,
      separatePageHeaderPresent: Boolean(
        separatePageHeader &&
          getComputedStyle(separatePageHeader).display !== 'none' &&
          separatePageHeader.getBoundingClientRect().height > 0,
      ),
      upsellVisible: Boolean(
        upsell &&
          getComputedStyle(upsell).display !== 'none' &&
          upsell.getBoundingClientRect().height > 0,
      ),
      mobileTabsVisible: Boolean(
        mobileTabs &&
          getComputedStyle(mobileTabs).display !== 'none' &&
          mobileTabs.getBoundingClientRect().height > 0,
      ),
    }
  })

  const shot = resolve(
    outDir,
    `leaderboard-shell-rev-${label}-${viewport.width}x${viewport.height}.png`,
  )
  await page.screenshot({ path: shot, fullPage: false })
  return { ...data, shot, viewport }
}

async function main() {
  // Preserve prior mobile shot as before for diff proof if present.
  const priorMobile = resolve(outDir, 'leaderboard-shell-phase1-390x844.png')
  const beforeMobile = resolve(outDir, 'leaderboard-shell-rev-mobile-before-390x844.png')
  if (existsSync(priorMobile) && !existsSync(beforeMobile)) {
    copyFileSync(priorMobile, beforeMobile)
  }

  const browser = await chromium.launch({ headless: true })
  // Creator Pucky — Basic pool → upsell should show
  const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
  const context = await browser.newContext()
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()

  const results = {}
  for (const vp of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    results[`${vp.width}x${vp.height}`] = await probe(page, vp, 'after')
  }

  await browser.close()
  const reportPath = resolve(outDir, 'leaderboard-shell-rev-report.json')
  writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  console.log('Wrote', reportPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
