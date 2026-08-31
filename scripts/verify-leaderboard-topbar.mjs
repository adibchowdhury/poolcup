/**
 * Desktop top-bar refinements: avatar, metadata row, h-14 parity, mobile proof.
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

  // Dashboard height baseline
  const ctxDash = await browser.newContext()
  await ctxDash.addCookies(await authAs(creatorId))
  const pageDash = await ctxDash.newPage()
  await pageDash.setViewportSize({ width: 1440, height: 900 })
  await pageDash.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 90000 })
  await pageDash.waitForTimeout(600)
  const dashH = await pageDash.evaluate(() => {
    const bar = document.querySelector('header[aria-label="Page header"]')
    return bar ? Math.round(bar.getBoundingClientRect().height) : null
  })
  await ctxDash.close()

  const ctx = await browser.newContext()
  await ctx.addCookies(await authAs(creatorId))
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1200)

  const data = await page.evaluate(() => {
    const bar = document.querySelector('header[aria-label="Pool page header"]')
    if (!bar) return { present: false }
    const rect = bar.getBoundingClientRect()
    const back = bar.querySelector('button[aria-label="Back to dashboard"]')
    const h1 = bar.querySelector('h1')
    const meta = h1?.nextElementSibling
    const avatar = bar.querySelector('[style*="width"], img')
    // Find avatar container by size near 36
    const candidates = [...bar.querySelectorAll('div')].filter((d) => {
      const r = d.getBoundingClientRect()
      return Math.abs(r.width - 36) < 2 && Math.abs(r.height - 36) < 2
    })
    const text = (bar.textContent || '').replace(/\s+/g, ' ')
    return {
      height: Math.round(rect.height),
      hasBackArrow: Boolean(back),
      title: h1?.textContent?.trim() ?? null,
      titleFontSize: h1 ? getComputedStyle(h1).fontSize : null,
      metaText: meta?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      metaFontSize: meta ? getComputedStyle(meta).fontSize : null,
      metaColor: meta ? getComputedStyle(meta).color : null,
      avatarPx: candidates[0]
        ? Math.round(candidates[0].getBoundingClientRect().width)
        : null,
      hasScorePredictor: /Score Predictor/i.test(text),
      hasMembers: /\d+\s+members/i.test(text),
      hasVisibility: /Private pool|Public pool/i.test(text),
      snippet: text.slice(0, 220),
    }
  })

  const shot = resolve(outDir, 'leaderboard-topbar-after-1440x900.png')
  await page.screenshot({ path: shot, fullPage: false })
  await ctx.close()

  const ctxMobile = await browser.newContext()
  await ctxMobile.addCookies(await authAs(memberId))
  const pageMobile = await ctxMobile.newPage()
  await pageMobile.setViewportSize({ width: 390, height: 844 })
  await pageMobile.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await pageMobile.waitForTimeout(1200)
  const shotMobile = resolve(outDir, 'leaderboard-topbar-after-390x844.png')
  await pageMobile.screenshot({ path: shotMobile, fullPage: false })
  await ctxMobile.close()
  await browser.close()

  const beforeMobile = resolve(outDir, 'leaderboard-topbar-mobile-before-390x844.png')
  const diffMobile = resolve(outDir, 'leaderboard-topbar-mobile-diff.png')
  const report = {
    dashboardTopBarHeight: dashH,
    leaderboard: data,
    heightParity: dashH === data.height,
    shot,
    mobileDiff: pixelExact(beforeMobile, shotMobile, diffMobile),
  }
  writeFileSync(resolve(outDir, 'leaderboard-topbar-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
