/**
 * Phase-1 leaderboard shell verification + screenshots.
 * Usage: node scripts/verify-leaderboard-shell-phase1.mjs
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const poolPath = '/pool/afcaad5c?tab=leaderboard'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

async function authCookies() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  // Pool member Tennis Martin (linked user on test pool f407e0c6-…)
  const memberUserId = 'a8a7b220-43d2-4fa0-919e-d7143c6d04cb'
  const { data: got, error: gotErr } = await admin.auth.admin.getUserById(
    memberUserId,
  )
  if (gotErr || !got.user?.email) {
    throw new Error(gotErr?.message ?? 'member user missing email')
  }
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
  if (!verified.data.session) {
    throw new Error(verified.error?.message ?? 'no session')
  }
  const { access_token, refresh_token } = verified.data.session
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
    '.',
  )[0]
  return [
    {
      name: `sb-${projectRef}-auth-token`,
      value: JSON.stringify({
        access_token,
        refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user,
      }),
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]
}

async function probe(page, viewport) {
  await page.setViewportSize(viewport)
  await page.goto(`${baseUrl}${poolPath}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1500)

  const data = await page.evaluate(() => {
    const sidebar = document.querySelector(
      'aside[aria-label="Pool navigation and info"]',
    )
    const url = location.pathname + location.search
    const shellHeader = document.querySelector('h1.font-display.text-3xl')
    const h1s = [...document.querySelectorAll('h1')].map((h) =>
      (h.textContent || '').trim().slice(0, 80),
    )
    const floatingNav = document.querySelector('nav[aria-label="Pool sections"]')
    const mobileTabList = document.querySelector(
      '.lg\\:hidden [role="tablist"], .lg\\:hidden .grid-cols-3',
    )
    const inviteBtns = [...document.querySelectorAll('button')].filter((b) =>
      /invite members|^invite$/i.test((b.textContent || '').trim()),
    )
    const reportQuiet = [...document.querySelectorAll('button')].find(
      (b) =>
        (b.textContent || '').trim() === 'Report issue' &&
        !b.className.includes('ui-tactile-btn'),
    )
    const bodyText = document.body.innerText.slice(0, 500)

    const sc = sidebar ? getComputedStyle(sidebar) : null
    return {
      url,
      h1s,
      shellHeaderText: shellHeader?.textContent?.trim()?.slice(0, 80) ?? null,
      bodySnippet: bodyText.slice(0, 200),
      sidebar: sidebar
        ? {
            display: sc.display,
            width: Math.round(sidebar.getBoundingClientRect().width),
            bg: sc.backgroundColor,
            borderRight: sc.borderRightColor,
            visible:
              sc.display !== 'none' &&
              sidebar.getBoundingClientRect().width > 0,
            text: (sidebar.textContent || '').replace(/\s+/g, ' ').slice(0, 200),
          }
        : { present: false },
      floatingNavDisplay: floatingNav
        ? getComputedStyle(floatingNav).display
        : null,
      mobileTabsVisible: Boolean(
        mobileTabList &&
          getComputedStyle(mobileTabList).display !== 'none' &&
          mobileTabList.getBoundingClientRect().height > 0,
      ),
      inviteCount: inviteBtns.length,
      quietReport: Boolean(reportQuiet),
      memberMono: [...document.querySelectorAll('.font-mono')].some((el) =>
        /\d+/.test(el.textContent || ''),
      ),
    }
  })

  const shot = resolve(
    outDir,
    `leaderboard-shell-phase1-${viewport.width}x${viewport.height}.png`,
  )
  await page.screenshot({ path: shot, fullPage: false })
  return { ...data, shot, viewport }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  await context.addCookies(await authCookies())
  const page = await context.newPage()
  page.on('pageerror', (err) => {
    console.error('PAGEERROR', err.message)
  })

  const results = {}
  for (const vp of [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    results[`${vp.width}x${vp.height}`] = await probe(page, vp)
  }

  await browser.close()
  const reportPath = resolve(outDir, 'leaderboard-shell-phase1-report.json')
  writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  console.log('Wrote', reportPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
