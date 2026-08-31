/**
 * Sidebar polish verification: bigger logo, pool-info rows, activity sizing, fit.
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

async function probe(page, viewport) {
  await page.setViewportSize(viewport)
  await page.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1200)
  return page.evaluate(() => {
    const sidebar = document.querySelector('aside[aria-label="Pool navigation and info"]')
    if (!sidebar) return { present: false }
    const sc = getComputedStyle(sidebar)
    const logoImg = sidebar.querySelector('a[aria-label="PoolCup home"] img')
    const nameEl = [...sidebar.querySelectorAll('p')].find((p) =>
      /Office World Cup/i.test(p.textContent || ''),
    )
    const activityLabel = [...sidebar.querySelectorAll('p')].find((p) =>
      /recent activity/i.test(p.textContent || ''),
    )
    const activityItems =
      activityLabel?.parentElement?.querySelectorAll('ul li')?.length ?? 0
    const activityLine = activityLabel?.parentElement?.querySelector('ul li p')
    const hasCard =
      [...sidebar.querySelectorAll('.rounded-xl.border')].filter((el) =>
        /Members|Pool Type|Kickoff/i.test(el.textContent || ''),
      ).length > 0
    const membersRow = [...sidebar.querySelectorAll('div')].find(
      (d) =>
        d.children.length === 2 &&
        /Members/i.test(d.children[0]?.textContent || '') &&
        /^\d+$/.test((d.children[1]?.textContent || '').trim()),
    )
    return {
      overflow: `${sc.overflow}/${sc.overflowY}`,
      scrollHeight: sidebar.scrollHeight,
      clientHeight: sidebar.clientHeight,
      canScroll: sidebar.scrollHeight > sidebar.clientHeight + 1,
      activityItems,
      logo: logoImg
        ? {
            w: Math.round(logoImg.getBoundingClientRect().width),
            h: Math.round(logoImg.getBoundingClientRect().height),
            pctOfSidebar: Number(
              (
                (logoImg.getBoundingClientRect().width /
                  sidebar.getBoundingClientRect().width) *
                100
              ).toFixed(1),
            ),
          }
        : null,
      nameFontSize: nameEl ? getComputedStyle(nameEl).fontSize : null,
      activityFontSize: activityLine ? getComputedStyle(activityLine).fontSize : null,
      activityAvatarH: (() => {
        const av = activityLabel?.parentElement?.querySelector('ul li img, ul li [class*="avatar"]')
        return av ? Math.round(av.getBoundingClientRect().height) : null
      })(),
      poolInfoHasCard: hasCard,
      membersRowJustify: membersRow
        ? getComputedStyle(membersRow).justifyContent
        : null,
    }
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
  const memberId = 'a8a7b220-43d2-4fa0-919e-d7143c6d04cb'

  const ctx = await browser.newContext()
  await ctx.addCookies(await authAs(creatorId))
  const page = await ctx.newPage()

  const results = {}
  for (const vp of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    const data = await probe(page, vp)
    const shot = resolve(
      outDir,
      `leaderboard-shell-polish-after-${vp.width}x${vp.height}.png`,
    )
    await page.screenshot({ path: shot, fullPage: false })
    results[`${vp.width}x${vp.height}`] = { ...data, shot, viewport: vp }
  }
  await ctx.close()

  const ctxMobile = await browser.newContext()
  await ctxMobile.addCookies(await authAs(memberId))
  const pageMobile = await ctxMobile.newPage()
  await pageMobile.setViewportSize({ width: 390, height: 844 })
  await pageMobile.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await pageMobile.waitForTimeout(1200)
  const shotMobile = resolve(outDir, 'leaderboard-shell-polish-after-390x844.png')
  await pageMobile.screenshot({ path: shotMobile, fullPage: false })
  await ctxMobile.close()
  await browser.close()

  const beforeMobile = resolve(outDir, 'leaderboard-shell-polish-mobile-before-390x844.png')
  const diffMobile = resolve(outDir, 'leaderboard-shell-polish-mobile-diff.png')
  results.mobileDiff = pixelExact(beforeMobile, shotMobile, diffMobile)

  const reportPath = resolve(outDir, 'leaderboard-shell-polish-report.json')
  writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
