/**
 * Scaled leaderboard top bar verification.
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

async function main() {
  const browser = await chromium.launch({ headless: true })
  const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
  const memberId = 'a8a7b220-43d2-4fa0-919e-d7143c6d04cb'

  const ctx = await browser.newContext()
  await ctx.addCookies(await authAs(creatorId))
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1200)

  const data = await page.evaluate(() => {
    const bar = document.querySelector('header[aria-label="Pool page header"]')
    if (!bar) return { present: false }
    const inner = bar.firstElementChild
    const h1 = bar.querySelector('h1')
    const meta = h1?.nextElementSibling
    const avatar = [...bar.querySelectorAll('div')].find((d) => {
      const r = d.getBoundingClientRect()
      return Math.abs(r.width - 48) < 2 && Math.abs(r.height - 48) < 2
    })
    const settings = bar.querySelector('button[aria-label="Pool settings"]')
    const cs = getComputedStyle(bar)
    return {
      height: Math.round(bar.getBoundingClientRect().height),
      innerHeight: inner ? Math.round(inner.getBoundingClientRect().height) : null,
      borderBottomWidth: cs.borderBottomWidth,
      borderBottomStyle: cs.borderBottomStyle,
      avatarPx: avatar ? Math.round(avatar.getBoundingClientRect().width) : null,
      titleFontSize: h1 ? getComputedStyle(h1).fontSize : null,
      metaFontSize: meta ? getComputedStyle(meta).fontSize : null,
      settingsH: settings ? Math.round(settings.getBoundingClientRect().height) : null,
      settingsFont: settings ? getComputedStyle(settings).fontSize : null,
    }
  })

  const shot = resolve(outDir, 'leaderboard-topbar-scale-after-1440x900.png')
  await page.screenshot({ path: shot, fullPage: false })
  await ctx.close()

  const ctxM = await browser.newContext()
  await ctxM.addCookies(await authAs(memberId))
  const pageM = await ctxM.newPage()
  await pageM.setViewportSize({ width: 390, height: 844 })
  await pageM.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await pageM.waitForTimeout(1200)
  const shotM = resolve(outDir, 'leaderboard-topbar-scale-after-390x844.png')
  await pageM.screenshot({ path: shotM, fullPage: false })
  await ctxM.close()
  await browser.close()

  const before = resolve(outDir, 'leaderboard-topbar-scale-mobile-before-390x844.png')
  let mobileDiff = null
  if (existsSync(before) && existsSync(shotM)) {
    const img1 = PNG.sync.read(readFileSync(before))
    const img2 = PNG.sync.read(readFileSync(shotM))
    const diff = new PNG({ width: img1.width, height: img1.height })
    const mismatched = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, {
      threshold: 0,
    })
    writeFileSync(resolve(outDir, 'leaderboard-topbar-scale-mobile-diff.png'), PNG.sync.write(diff))
    mobileDiff = {
      mismatched,
      total: img1.width * img1.height,
      percent: Number(((mismatched / (img1.width * img1.height)) * 100).toFixed(4)),
    }
  }

  const report = { ...data, shot, mobileDiff }
  writeFileSync(resolve(outDir, 'leaderboard-topbar-scale-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
