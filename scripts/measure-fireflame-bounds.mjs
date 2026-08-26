/**
 * Measure fireflame.lottie visible bounds + verify visible base meets card top.
 * Run: VERIFY_URL=http://localhost:3000 node scripts/measure-fireflame-bounds.mjs
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

dotenv.config({ path: '.env.local' })

const BASE = process.env.VERIFY_URL ?? 'http://localhost:3000'
const OUT = path.join(process.cwd(), '.verify-flame')
const ALPHA_THRESHOLD = 12

async function authCookies() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 5 })
  const user = list.users.find((u) => u.email)
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
  const { access_token, refresh_token } = verified.data.session
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
  return [{
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
  }]
}

async function goToPlanStep(page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.getByRole('button', { name: /Create (a )?Pool/i }).first().click()
  await page.locator('.create-competition-step__sport').first().click()
  await page.locator('.create-competition-step__row').first().click()
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Continue')
    return b && !b.disabled
  })
  await page.getByRole('button', { name: /^Continue$/i }).first().click()
  await page.locator('button[aria-pressed]').first().click()
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Continue')
    return b && !b.disabled
  })
  await page.getByRole('button', { name: /^Continue$/i }).first().click()
  await page.locator('input[type="text"]').first().fill('Test Pool')
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Continue')
    return b && !b.disabled
  })
  await page.getByRole('button', { name: /^Continue$/i }).first().click()
  await page.waitForSelector('.create-pool-plan-fire-overlay canvas', { timeout: 20000 })
  await page.waitForTimeout(2000)
}

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' })
await context.addCookies(await authCookies())
const page = await context.newPage()
await goToPlanStep(page)

const report = await page.evaluate((alphaThreshold) => {
  const canvas = document.querySelector('.create-pool-plan-fire-overlay canvas')
  const card = document.querySelector('[data-create-pool-pane="left"] .create-pool-plan-card--custom')
  const w = canvas.width
  const h = canvas.height
  const { data } = canvas.getContext('2d').getImageData(0, 0, w, h)

  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3]
      if (a > alphaThreshold) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  const canvasRect = canvas.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()
  const cardTop = cardRect.top
  const cardCenter = cardRect.left + cardRect.width / 2
  const scaleY = canvasRect.height / h
  const scaleX = canvasRect.width / w

  const visibleBottomViewport = canvasRect.top + (maxY + 1) * scaleY
  const visibleCenterViewport = canvasRect.left + ((minX + maxX + 1) / 2) * scaleX

  const cardTopY = Math.round(cardTop)
  let contactAtCardTop = false
  for (let dy = -2; dy <= 2; dy++) {
    for (let x = Math.round(canvasRect.left); x < Math.round(canvasRect.right); x++) {
      const cx = Math.floor((x - canvasRect.left) / scaleX)
      const cy = Math.floor((cardTopY + dy - canvasRect.top) / scaleY)
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue
      if (data[(cy * w + cx) * 4 + 3] > alphaThreshold) {
        contactAtCardTop = true
        break
      }
    }
    if (contactAtCardTop) break
  }

  return {
    margins: {
      top: minY / h,
      bottom: (h - 1 - maxY) / h,
      left: minX / w,
      right: (w - 1 - maxX) / w,
    },
    canvasPixel: { w, h, minX, minY, maxX, maxY },
    visualVerification: {
      visibleBottomGapPx: Math.round((visibleBottomViewport - cardTop) * 100) / 100,
      horizontalCenterGapPx: Math.round((visibleCenterViewport - cardCenter) * 100) / 100,
      artworkCenterFraction: (minX + maxX + 1) / (2 * w),
      passVisibleBase: Math.abs(visibleBottomViewport - cardTop) <= 2,
      passHorizontalCenter: Math.abs(visibleCenterViewport - cardCenter) <= 3,
      passContactAtCardTop: contactAtCardTop,
    },
  }
}, ALPHA_THRESHOLD)

await page.locator('.create-pool-wizard--modal').screenshot({ path: path.join(OUT, 'step4-visible-verify.png') })
await writeFile(path.join(OUT, 'fireflame-margins.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))

await browser.close()
