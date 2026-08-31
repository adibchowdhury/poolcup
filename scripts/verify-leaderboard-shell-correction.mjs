/**
 * Leaderboard shell correction verification + screenshots.
 * Asserts: full-height fixed sidebar, top bar constrained to main column,
 * ungated Commissioner CTA, mobile structurally identical.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'fs'
import { createHash } from 'crypto'
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
    const sbRect = sidebar?.getBoundingClientRect()
    const topBar = document.querySelector('header[aria-label="Pool page header"]')
    const tbRect = topBar?.getBoundingClientRect()
    const topBarH1 = topBar?.querySelector('h1.font-display')
    const text = sidebar ? (sidebar.textContent || '').replace(/\s+/g, ' ') : ''
    const upsell = [...document.querySelectorAll('button')].find((b) =>
      /upgrade to commissioner/i.test(b.textContent || ''),
    )
    const mobileTabs = document.querySelector(
      '.lg\\:hidden .grid-cols-3, .lg\\:hidden [role="tablist"]',
    )
    const headers = [...document.querySelectorAll('header')]
    const mobileHeader = headers.find(
      (h) => h.getAttribute('aria-label') !== 'Pool page header',
    )
    return {
      url: location.pathname + location.search,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      sidebar: sidebar
        ? {
            display: sc.display,
            position: sc.position,
            height: Math.round(sbRect.height),
            width: Math.round(sbRect.width),
            y: Math.round(sbRect.y),
            fullViewportHeight: Math.abs(sbRect.height - window.innerHeight) < 2,
            startsAtTop: Math.abs(sbRect.y) < 2,
            hasUpsell: /Make your pool standout/i.test(text),
          }
        : { present: false },
      topBar: topBar
        ? {
            display: getComputedStyle(topBar).display,
            x: Math.round(tbRect.x),
            width: Math.round(tbRect.width),
            constrainedToMainColumn:
              tbRect.x >= 200 && tbRect.width < window.innerWidth - 100,
            title: topBarH1?.textContent?.trim()?.slice(0, 80) ?? null,
            titleAlign: topBarH1 ? getComputedStyle(topBarH1).textAlign : null,
          }
        : { present: false },
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
      mobileHeaderDisplay: mobileHeader
        ? getComputedStyle(mobileHeader).display
        : null,
    }
  })

  const shot = resolve(
    outDir,
    `leaderboard-shell-corr-${label}-${viewport.width}x${viewport.height}.png`,
  )
  await page.screenshot({ path: shot, fullPage: false })
  return { ...data, shot, viewport }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
  const memberId = 'a8a7b220-43d2-4fa0-919e-d7143c6d04cb'

  const ctxDesktop = await browser.newContext()
  await ctxDesktop.addCookies(await authAs(creatorId))
  const pageDesktop = await ctxDesktop.newPage()

  const results = {}
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    results[`${vp.width}x${vp.height}`] = await probe(pageDesktop, vp, 'after')
  }
  await ctxDesktop.close()

  const ctxMobile = await browser.newContext()
  await ctxMobile.addCookies(await authAs(memberId))
  const pageMobile = await ctxMobile.newPage()
  results['390x844'] = await probe(pageMobile, { width: 390, height: 844 }, 'after')
  await ctxMobile.close()

  await browser.close()

  const beforeMobile = resolve(outDir, 'leaderboard-shell-corr-mobile-before-390x844.png')
  const afterMobile = resolve(outDir, 'leaderboard-shell-corr-after-390x844.png')
  if (existsSync(beforeMobile) && existsSync(afterMobile)) {
    const b1 = readFileSync(beforeMobile)
    const b2 = readFileSync(afterMobile)
    const h1 = createHash('sha256').update(b1).digest('hex')
    const h2 = createHash('sha256').update(b2).digest('hex')
    results.mobileByteIdentical = h1 === h2
    results.mobileHashes = { before: h1.slice(0, 12), after: h2.slice(0, 12) }
  }

  const reportPath = resolve(outDir, 'leaderboard-shell-corr-report.json')
  writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  console.log('Wrote', reportPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
