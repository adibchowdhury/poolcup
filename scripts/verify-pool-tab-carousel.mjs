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

function probeCarousel() {
  return page.evaluate(() => {
    const root = document.querySelector('[data-pool-tab-carousel]')
    const track = root?.firstElementChild
    const panes = Array.from(
      document.querySelectorAll('[data-pool-tab-pane]'),
    ).map((el) => ({
      index: el.getAttribute('data-pool-tab-pane'),
      ariaHidden: el.getAttribute('aria-hidden'),
      textLen: (el.textContent ?? '').replace(/\s+/g, ' ').trim().length,
      sample: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48),
    }))
    const indicator = document.querySelector(
      '[role="tablist"][aria-label="Pool sections"] .bg-primary, [role="tablist"][aria-label="Pool sections"] [aria-hidden].will-change-transform, [role="tablist"] [class*="bg-primary"]',
    )
    // Prefer the absolute bottom indicator span
    const ind =
      document.querySelector(
        '[role="tablist"][aria-label="Pool sections"] span[aria-hidden]',
      ) ?? indicator
    const trackCs = track ? getComputedStyle(track) : null
    const indCs = ind ? getComputedStyle(ind) : null
    return {
      hasCarousel: Boolean(root),
      paneCount: panes.length,
      panes,
      trackTransform: trackCs?.transform ?? null,
      trackTransition: trackCs?.transition ?? null,
      indicatorTransform: indCs?.transform ?? null,
      indicatorTransition: indCs?.transition ?? null,
      indicatorOpacity: indCs?.opacity ?? null,
      activeTab: Array.from(
        document.querySelectorAll(
          '[role="tablist"][aria-label="Pool sections"] [role="tab"]',
        ),
      )
        .find((t) => t.getAttribute('aria-selected') === 'true')
        ?.textContent?.trim(),
    }
  })
}

async function tapTab(label) {
  await page.getByRole('tab', { name: label, exact: true }).click()
}

async function waitActive(label) {
  await page.waitForFunction(
    (name) => {
      const tab = Array.from(
        document.querySelectorAll(
          '[role="tablist"][aria-label="Pool sections"] [role="tab"]',
        ),
      ).find((t) => t.textContent?.trim() === name)
      return tab?.getAttribute('aria-selected') === 'true'
    },
    label,
    { timeout: 3000 },
  )
}

async function swipe(dx) {
  const b = await page.locator('main').boundingBox()
  if (!b) return
  const y = b.y + Math.min(400, b.height * 0.4)
  const x0 = b.x + b.width * 0.5
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
await page.waitForTimeout(1500)
// Wait for matchMedia mobile hook to flip isPoolMobile
await page.waitForFunction(
  () => Boolean(document.querySelector('[data-pool-tab-carousel]')),
  { timeout: 8000 },
)

const atHome = await probeCarousel()
const shotHome = resolve(outDir, 'pool-tab-carousel-home-390.png')
await page.screenshot({ path: shotHome, fullPage: false })

// Mid-slide Home → Predictions
await tapTab('Predictions')
await page.waitForTimeout(120)
const midHomeToPred = await probeCarousel()
const shotMidFwd = resolve(outDir, 'pool-tab-carousel-mid-home-to-pred-390.png')
await page.screenshot({ path: shotMidFwd, fullPage: false })
await waitActive('Predictions')
await page.waitForTimeout(200)
const atPred = await probeCarousel()
const shotPred = resolve(outDir, 'pool-tab-carousel-predictions-390.png')
await page.screenshot({ path: shotPred, fullPage: false })

// Back Predictions → Home
await tapTab('Home')
await page.waitForTimeout(120)
const midPredToHome = await probeCarousel()
const shotMidBack = resolve(outDir, 'pool-tab-carousel-mid-pred-to-home-390.png')
await page.screenshot({ path: shotMidBack, fullPage: false })
await waitActive('Home')
await page.waitForTimeout(200)

// Two-pane skip Home → Leaderboard
await tapTab('Leaderboard')
await page.waitForTimeout(120)
const midHomeToLb = await probeCarousel()
const shotMidSkip = resolve(outDir, 'pool-tab-carousel-mid-home-to-lb-390.png')
await page.screenshot({ path: shotMidSkip, fullPage: false })
await waitActive('Leaderboard')
await page.waitForTimeout(200)
const atLb = await probeCarousel()
const shotLb = resolve(outDir, 'pool-tab-carousel-leaderboard-390.png')
await page.screenshot({ path: shotLb, fullPage: false })

// Swipe left on leaderboard should no-op / stay; go to predictions then swipe to lb
await tapTab('Predictions')
await waitActive('Predictions')
await page.waitForTimeout(320)
await swipe(-120)
await page.waitForTimeout(350)
const afterSwipe = await probeCarousel()

// Blank-flash check: all three panes always have content while carousel mounted
const blankCheck = {
  allPanesMounted: atHome.paneCount === 3,
  allHaveContent: atHome.panes.every((p) => p.textLen > 20),
  midSkipPanesStillFilled: midHomeToLb.panes.every((p) => p.textLen > 20),
}

// Desktop: no carousel
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(`${baseUrl}/pool/${invite}?tab=predictions`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(900)
const desktop = await page.evaluate(() => ({
  hasCarousel: Boolean(document.querySelector('[data-pool-tab-carousel]')),
  mobileTablistVisible: (() => {
    const el = document.querySelector(
      '[role="tablist"][aria-label="Pool sections"]',
    )
    if (!el) return false
    const cs = getComputedStyle(el)
    return cs.display !== 'none' && cs.visibility !== 'hidden'
  })(),
}))

await browser.close()

function parseTranslateX(matrix) {
  if (!matrix || matrix === 'none') return 0
  const m = matrix.match(/matrix\(([^)]+)\)/)
  if (m) {
    const parts = m[1].split(',').map((s) => Number(s.trim()))
    return parts[4] ?? 0
  }
  const m3 = matrix.match(/matrix3d\(([^)]+)\)/)
  if (m3) {
    const parts = m3[1].split(',').map((s) => Number(s.trim()))
    return parts[12] ?? 0
  }
  return null
}

const report = {
  unifiedTrack: {
    sourceOfTruth:
      'activeTab (via goToSwipeTab for taps + usePoolTabSwipe). carouselIndex mirrors swipe-tab activeTab; PoolMobileTabCarousel translate3d(-index*100%,0,0) + tab underline translate3d(+index*100%,0,0) share POOL_TAB_CAROUSEL_MS (280).',
    homeToLeaderboardSkip:
      'Index 0→2 in one setState; track animates continuously to translateX(-200%) — Predictions pane slides through mid-motion.',
    reducedMotion: 'usePrefersReducedMotion → transitionDuration 0ms on track + indicator.',
  },
  blankCheck,
  probes: {
    atHome,
    midHomeToPred: {
      ...midHomeToPred,
      trackTx: parseTranslateX(midHomeToPred.trackTransform),
    },
    atPred,
    midPredToHome: {
      ...midPredToHome,
      trackTx: parseTranslateX(midPredToHome.trackTransform),
    },
    midHomeToLb: {
      ...midHomeToLb,
      trackTx: parseTranslateX(midHomeToLb.trackTransform),
    },
    atLb,
    afterSwipe,
  },
  desktop,
  shots: {
    shotHome,
    shotMidFwd,
    shotPred,
    shotMidBack,
    shotMidSkip,
    shotLb,
  },
}

writeFileSync(
  resolve(outDir, 'pool-tab-carousel-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
