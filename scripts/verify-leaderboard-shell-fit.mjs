/**
 * Sidebar fit + CTA horizontal layout verification.
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
    const activityLis = [
      ...sidebar.querySelectorAll('ul li'),
    ].filter((li) => {
      // activity items have avatar + line; exclude nothing else in ul
      return true
    })
    // Prefer counting under Recent activity heading
    const labels = [...sidebar.querySelectorAll('p')]
    const activityLabel = labels.find((p) => /recent activity/i.test(p.textContent || ''))
    let activityItems = 0
    if (activityLabel) {
      const section = activityLabel.parentElement
      activityItems = section?.querySelectorAll('ul li')?.length ?? 0
    }
    const pucky = sidebar.querySelector('img[src*="pucky_trophy"]')
    const upgrade = [...sidebar.querySelectorAll('button')].find((b) =>
      /upgrade to commissioner/i.test(b.textContent || ''),
    )
    const scrollH = sidebar.scrollHeight
    const clientH = sidebar.clientHeight
    return {
      overflow: sc.overflow + '/' + sc.overflowY,
      scrollHeight: scrollH,
      clientHeight: clientH,
      canScroll: scrollH > clientH + 1,
      activityItems,
      pucky: pucky
        ? {
            w: Math.round(pucky.getBoundingClientRect().width),
            h: Math.round(pucky.getBoundingClientRect().height),
          }
        : null,
      ctaButtonFullWidth: upgrade
        ? Math.abs(
            upgrade.getBoundingClientRect().width -
              (upgrade.parentElement?.getBoundingClientRect().width ?? 0) +
              // parent is card with padding — compare to card content roughly
              0,
          ) < 40 ||
          upgrade.className.includes('w-full')
        : null,
      upgradeWidth: upgrade ? Math.round(upgrade.getBoundingClientRect().width) : null,
      cardWidth: upgrade?.parentElement
        ? Math.round(upgrade.parentElement.getBoundingClientRect().width)
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
      `leaderboard-shell-fit-after-${vp.width}x${vp.height}.png`,
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
  const shotMobile = resolve(outDir, 'leaderboard-shell-fit-after-390x844.png')
  await pageMobile.screenshot({ path: shotMobile, fullPage: false })
  await ctxMobile.close()
  await browser.close()

  const beforeMobile = resolve(outDir, 'leaderboard-shell-fit-mobile-before-390x844.png')
  const diffMobile = resolve(outDir, 'leaderboard-shell-fit-mobile-diff.png')
  results.mobileDiff = pixelExact(beforeMobile, shotMobile, diffMobile)

  const reportPath = resolve(outDir, 'leaderboard-shell-fit-report.json')
  writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
