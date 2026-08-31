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

async function gotoTab(tab) {
  await page.goto(`${baseUrl}/pool/${invite}?tab=${tab}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(900)
}

function probeChrome() {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main navigation"]')
    const navVisible =
      nav &&
      getComputedStyle(nav).visibility !== 'hidden' &&
      getComputedStyle(nav).opacity !== '0'
    const tablist = document.querySelector('[role="tablist"][aria-label="Pool sections"]')
    const tabs = Array.from(tablist?.querySelectorAll('[role="tab"]') ?? []).map(
      (t) => ({
        label: t.textContent?.replace(/\s+/g, ' ').trim(),
        active: t.getAttribute('aria-selected') === 'true',
        color: getComputedStyle(t).color,
        borderBottomColor: getComputedStyle(t).borderBottomColor,
      }),
    )
    const overflow = document.querySelector('button[aria-label="Pool options"]')
    const main = document.querySelector('main')
    const padLeft = main ? getComputedStyle(main).paddingLeft : null
    // content pad is on TabsContent — check first section / home
    const padded = document.querySelector('[data-slot="tabs-content"]')
    return {
      bottomNavPresent: Boolean(nav),
      bottomNavVisible: Boolean(navVisible),
      tabs,
      hasOverflow: Boolean(overflow),
      contentPad:
        padded ? getComputedStyle(padded).paddingLeft : null,
      mainPb: main ? getComputedStyle(main).paddingBottom : null,
    }
  })
}

await gotoTab('home')
const homeProbe = await probeChrome()
const shotHome = resolve(outDir, 'pool-mobile-restructure-home-390.png')
await page.screenshot({ path: shotHome, fullPage: false })

await page.click('button[aria-label="Pool options"]')
await page.waitForTimeout(400)
const menuItems = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="menuitem"]')).map((el) =>
    el.textContent?.replace(/\s+/g, ' ').trim(),
  ),
)
const shotMenu = resolve(outDir, 'pool-mobile-restructure-menu-390.png')
await page.screenshot({ path: shotMenu, fullPage: false })
await page.keyboard.press('Escape')

await gotoTab('predictions')
const predictionsProbe = await probeChrome()
const shotPred = resolve(outDir, 'pool-mobile-restructure-predictions-390.png')
await page.screenshot({ path: shotPred, fullPage: false })

await gotoTab('leaderboard')
const leaderboardProbe = await probeChrome()
const shotLb = resolve(outDir, 'pool-mobile-restructure-leaderboard-390.png')
await page.screenshot({ path: shotLb, fullPage: false })

// Settings via menu
await page.click('button[aria-label="Pool options"]')
await page.waitForTimeout(300)
await page.getByRole('menuitem', { name: 'Settings' }).click()
await page.waitForTimeout(900)
const settingsProbe = await page.evaluate(() => {
  const tabs = Array.from(
    document.querySelectorAll('[role="tablist"][aria-label="Pool sections"] [role="tab"]'),
  ).map((t) => ({
    label: t.textContent?.replace(/\s+/g, ' ').trim(),
    active: t.getAttribute('aria-selected') === 'true',
  }))
  const settingsVisible = Boolean(
    document.body.innerText.includes('Pool settings') ||
      document.body.innerText.includes('Details') ||
      document.body.innerText.includes('Danger'),
  )
  return { tabs, settingsVisible, url: location.href }
})
const shotSettings = resolve(outDir, 'pool-mobile-restructure-settings-390.png')
await page.screenshot({ path: shotSettings, fullPage: false })

// Back from settings
await page.click('button[aria-label="Back to pool"]')
await page.waitForTimeout(600)
const afterBack = await page.evaluate(() => ({
  url: location.href,
  tabs: Array.from(
    document.querySelectorAll('[role="tablist"][aria-label="Pool sections"] [role="tab"]'),
  ).map((t) => ({
    label: t.textContent?.replace(/\s+/g, ' ').trim(),
    active: t.getAttribute('aria-selected') === 'true',
  })),
}))

// Swipe: predictions → leaderboard (swipe left) then back
await gotoTab('predictions')
async function swipe(dx) {
  const b = await page.locator('main').boundingBox()
  if (!b) return
  const y = b.y + Math.min(400, b.height * 0.4)
  const x0 = b.x + b.width * 0.5
  await page.evaluate(
    ({ x0, y, dx }) => {
      const main = document.querySelector('main')
      if (!main) return
      const t0 = new Touch({
        identifier: 1,
        target: main,
        clientX: x0,
        clientY: y,
      })
      main.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [t0],
          targetTouches: [t0],
          changedTouches: [t0],
        }),
      )
      const t1 = new Touch({
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
          changedTouches: [t1],
        }),
      )
    },
    { x0, y, dx },
  )
  await page.waitForTimeout(400)
}

await swipe(-120) // left → next
const afterSwipeLeft = await page.evaluate(() =>
  Array.from(
    document.querySelectorAll(
      '[role="tablist"][aria-label="Pool sections"] [role="tab"]',
    ),
  )
    .filter((t) => t.getAttribute('aria-selected') === 'true')
    .map((t) => t.textContent?.trim()),
)
await swipe(120) // right → previous
const afterSwipeRight = await page.evaluate(() =>
  Array.from(
    document.querySelectorAll(
      '[role="tablist"][aria-label="Pool sections"] [role="tab"]',
    ),
  )
    .filter((t) => t.getAttribute('aria-selected') === 'true')
    .map((t) => t.textContent?.trim()),
)

// Desktop diff-proof
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(`${baseUrl}/pool/${invite}?tab=predictions`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(800)
const desktop = await page.evaluate(() => ({
  bottomNavHidden: (() => {
    const nav = document.querySelector('nav[aria-label="Main navigation"]')
    if (!nav) return true
    const cs = getComputedStyle(nav)
    return cs.display === 'none' || cs.visibility === 'hidden' || nav.classList.contains('lg:hidden')
  })(),
  mobileTablistHidden: (() => {
    const tl = document.querySelector('[role="tablist"][aria-label="Pool sections"]')
    if (!tl) return true
    return getComputedStyle(tl).display === 'none' || tl.closest('.lg\\:hidden') != null
  })(),
  hasDesktopSidebar: Boolean(
    document.querySelector('[aria-label="Pool navigation"]') ||
      document.body.innerText.includes('Invite members'),
  ),
}))
const shotDesktop = resolve(outDir, 'pool-mobile-restructure-desktop-1440.png')
await page.screenshot({ path: shotDesktop, fullPage: false })

await browser.close()

const report = {
  homeProbe,
  predictionsProbe,
  leaderboardProbe,
  menuItems,
  settingsProbe,
  afterBack,
  afterSwipeLeft,
  afterSwipeRight,
  desktop,
  shots: {
    shotHome,
    shotMenu,
    shotPred,
    shotLb,
    shotSettings,
    shotDesktop,
  },
}
writeFileSync(
  resolve(outDir, 'pool-mobile-restructure-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
