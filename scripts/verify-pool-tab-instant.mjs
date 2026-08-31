import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })
const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
const invite = '617c79ba'

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
  if (!verified.data.session) {
    throw new Error(verified.error?.message ?? 'no session')
  }
  const { access_token, refresh_token } = verified.data.session
  const projectRef = new URL(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ).hostname.split('.')[0]
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

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})
await context.addCookies(await authAs(creatorId))
const page = await context.newPage()
await page.goto(`${baseUrl}/pool/${invite}?tab=home`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(1200)

const mountProbe = await page.evaluate(() => {
  const panels = Array.from(
    document.querySelectorAll('[data-slot="tabs-content"]'),
  ).map((el) => ({
    value: el.getAttribute('data-state'),
    // Radix sets data-state active|inactive when forceMount
    forcePresent: el.isConnected,
    display: getComputedStyle(el).display,
    textSample: el.textContent?.slice(0, 40)?.replace(/\s+/g, ' '),
  }))
  // Count home/predictions/leaderboard panels specifically via presence of known markers
  const all = Array.from(document.querySelectorAll('[data-slot="tabs-content"]'))
  return {
    panelCount: all.length,
    panels: all.map((el) => ({
      state: el.getAttribute('data-state'),
      display: getComputedStyle(el).display,
      hiddenAttr: el.hidden,
    })),
  }
})

async function tapTab(label) {
  const t0 = Date.now()
  await page.getByRole('tab', { name: label, exact: true }).click()
  await page.waitForFunction(
    (name) => {
      const tab = Array.from(
        document.querySelectorAll('[role="tab"]'),
      ).find((t) => t.textContent?.trim() === name)
      return tab?.getAttribute('aria-selected') === 'true'
    },
    label,
    { timeout: 2000 },
  )
  return Date.now() - t0
}

const timings = {
  homeToPredictions: await tapTab('Predictions'),
  predictionsToLeaderboard: await tapTab('Leaderboard'),
  leaderboardToHome: await tapTab('Home'),
}

const afterRapid = await page.evaluate(() => {
  const tabs = Array.from(
    document.querySelectorAll('[role="tablist"][aria-label="Pool sections"] [role="tab"]'),
  ).map((t) => {
    const cs = getComputedStyle(t)
    return {
      label: t.textContent?.trim(),
      active: t.getAttribute('aria-selected') === 'true',
      color: cs.color,
      borderBottom: cs.borderBottomColor,
      hasSvg: Boolean(t.querySelector('svg')),
    }
  })
  const nudgeOnHome = document.body.innerText.includes("This pool's quiet")
  return { tabs, nudgeOnHome }
})

const shotHome = resolve(outDir, 'pool-tab-instant-home-390.png')
await page.screenshot({ path: shotHome, fullPage: false })

await tapTab('Predictions')
const nudgeOnPredictions = await page.evaluate(() =>
  document.body.innerText.includes("This pool's quiet"),
)
const shotPred = resolve(outDir, 'pool-tab-instant-predictions-390.png')
await page.screenshot({ path: shotPred, fullPage: false })

await tapTab('Leaderboard')
const nudgeOnLeaderboard = await page.evaluate(() =>
  document.body.innerText.includes("This pool's quiet"),
)
const shotLb = resolve(outDir, 'pool-tab-instant-leaderboard-390.png')
await page.screenshot({ path: shotLb, fullPage: false })

// Swipe timing home<- from predictions
await tapTab('Predictions')
async function swipe(dx) {
  const b = await page.locator('main').boundingBox()
  if (!b) return null
  const y = b.y + Math.min(400, b.height * 0.4)
  const x0 = b.x + b.width * 0.5
  const t0 = Date.now()
  await page.evaluate(
    ({ x0, y, dx }) => {
      const main = document.querySelector('main')
      if (!main) return
      const tStart = new Touch({
        identifier: 1,
        target: main,
        clientX: x0,
        clientY: y,
      })
      main.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [tStart],
          targetTouches: [tStart],
          changedTouches: [tStart],
        }),
      )
      const tEnd = new Touch({
        identifier: 1,
        target: main,
        clientX: x0 + dx,
        clientY: y,
      })
      main.dispatchEvent(
        new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: [],
          targetTouches: [],
          changedTouches: [tEnd],
        }),
      )
    },
    { x0, y, dx },
  )
  await page.waitForTimeout(50)
  return Date.now() - t0
}
const swipeMs = await swipe(-120)
const afterSwipe = await page.evaluate(() =>
  Array.from(
    document.querySelectorAll('[role="tablist"][aria-label="Pool sections"] [role="tab"]'),
  )
    .filter((t) => t.getAttribute('aria-selected') === 'true')
    .map((t) => t.textContent?.trim()),
)

await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(`${baseUrl}/pool/${invite}?tab=predictions`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(700)
const desktop = await page.evaluate(() => ({
  mobileTablist: Boolean(
    document.querySelector('[role="tablist"][aria-label="Pool sections"]'),
  ),
  sidebarHasIcons: Boolean(
    document.querySelector('[aria-label="Pool navigation"] svg') ||
      document.body.innerText.includes('Predictions'),
  ),
}))

await browser.close()

const report = {
  diagnosis: {
    before:
      'Radix Tabs.Content unmounts inactive panels by default (Presence). Each tap remounted PoolHomeShell / PoolPredictionsTab / PoolLeaderboardStandings (React tree + layout + images). Not a Next.js route transition; same-page setActiveTab + shallow history.replace. Swipe used the same setActiveTab but still paid remount cost.',
    after:
      'forceMount on home/predictions/leaderboard TabsContent; inactive uses data-[state=inactive]:hidden. Tap + swipe both call goToSwipeTab → setActiveTab only (visibility swap). First paint mounts all three once.',
  },
  mountProbe,
  timingsMs: timings,
  swipeMs,
  afterSwipe,
  afterRapid,
  banner: {
    home: afterRapid.nudgeOnHome,
    predictions: nudgeOnPredictions,
    leaderboard: nudgeOnLeaderboard,
  },
  desktop,
  shots: { shotHome, shotPred, shotLb },
}
writeFileSync(
  resolve(outDir, 'pool-tab-instant-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
