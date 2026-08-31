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
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email })
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

async function probe(page, viewport) {
  await page.setViewportSize(viewport)
  await page.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1800)
  return page.evaluate(() => {
    const stadium = document.querySelector('.leaderboard-podium-stadium')
    const confetti = stadium?.querySelector('canvas')
    const header = [...document.querySelectorAll('[role="row"]')].find((el) =>
      /Position/i.test(el.textContent || ''),
    )
    const lastPickDashes = [...document.querySelectorAll('li')].filter((li) =>
      (li.textContent || '').includes('—'),
    ).length
    const listSection = document.querySelector('section[aria-label="Full standings"]')
    return {
      stadiumVisible: Boolean(
        stadium && getComputedStyle(stadium).display !== 'none' && stadium.getBoundingClientRect().height > 0,
      ),
      stadiumHasBg: Boolean(stadium?.querySelector('.leaderboard-podium-stadium__bg')),
      confettiCanvas: Boolean(confetti),
      tableHeaderVisible: Boolean(
        header && getComputedStyle(header).display !== 'none' && header.getBoundingClientRect().height > 0,
      ),
      headerText: header?.textContent?.replace(/\s+/g, ' ').trim()?.slice(0, 120) ?? null,
      lastPickDashRows: lastPickDashes,
      tableCardBorder: listSection ? getComputedStyle(listSection).borderTopWidth : null,
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
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    const data = await probe(page, vp)
    const shot = resolve(outDir, `leaderboard-phase2-after-${vp.width}x${vp.height}.png`)
    await page.screenshot({ path: shot, fullPage: false })
    results[`${vp.width}x${vp.height}`] = { ...data, shot }
  }
  await ctx.close()

  const ctxM = await browser.newContext()
  await ctxM.addCookies(await authAs(memberId))
  const pageM = await ctxM.newPage()
  await pageM.setViewportSize({ width: 390, height: 844 })
  await pageM.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await pageM.waitForTimeout(1200)
  const shotM = resolve(outDir, 'leaderboard-phase2-after-390x844.png')
  await pageM.screenshot({ path: shotM, fullPage: false })
  await ctxM.close()
  await browser.close()

  const before = resolve(outDir, 'leaderboard-phase2-mobile-before-390x844.png')
  let mobileDiff = null
  if (existsSync(before) && existsSync(shotM)) {
    const img1 = PNG.sync.read(readFileSync(before))
    const img2 = PNG.sync.read(readFileSync(shotM))
    const diff = new PNG({ width: img1.width, height: img1.height })
    const mismatched = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, {
      threshold: 0,
    })
    writeFileSync(resolve(outDir, 'leaderboard-phase2-mobile-diff.png'), PNG.sync.write(diff))
    mobileDiff = {
      mismatched,
      total: img1.width * img1.height,
      percent: Number(((mismatched / (img1.width * img1.height)) * 100).toFixed(4)),
    }
  }

  const report = { ...results, mobileDiff }
  writeFileSync(resolve(outDir, 'leaderboard-phase2-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
