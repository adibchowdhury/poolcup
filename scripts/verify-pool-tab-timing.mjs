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
const PHASE = process.env.POOL_TAB_TIMING_PHASE ?? 'before'

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
await page.waitForFunction(
  () => Boolean(document.querySelector('[data-pool-tab-carousel]')),
  { timeout: 10000 },
)
await page.waitForTimeout(800)

const mountBefore = await page.evaluate(() => {
  const panes = Array.from(document.querySelectorAll('[data-pool-tab-pane]'))
  return {
    carousel: Boolean(document.querySelector('[data-pool-tab-carousel]')),
    paneCount: panes.length,
    paneTextLens: panes.map((p) =>
      (p.textContent ?? '').replace(/\s+/g, ' ').trim().length,
    ),
  }
})

async function measureTap(label) {
  return page.evaluate(async (tabLabel) => {
    const track = document.querySelector('[data-pool-tab-track]')
    if (!track) return { error: 'no track' }
    const beforeTx = getComputedStyle(track).transform
    const tab = Array.from(
      document.querySelectorAll(
        '[role="tablist"][aria-label="Pool sections"] [role="tab"]',
      ),
    ).find((t) => t.textContent?.trim() === tabLabel)
    if (!tab) return { error: `no tab ${tabLabel}` }

    window.__poolTabTapMarks = undefined
    const beforeInline = track.style.transform
    const tClick = performance.now()
    tab.click()
    const afterInline = track.style.transform
    const afterInlineMs = performance.now() - tClick

    // Sample computed transform for the next few frames (before heavy React work).
    const earlyFrames = []
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => requestAnimationFrame(r))
      earlyFrames.push({
        i,
        ms: performance.now() - tClick,
        tx: getComputedStyle(track).transform,
        inline: track.style.transform,
      })
    }
    const firstChangedFrame = earlyFrames.find((f) => f.tx !== beforeTx)

    await new Promise((r) => requestAnimationFrame(r))
    const marks = window.__poolTabTapMarks ?? null
    return {
      tabLabel,
      beforeTx,
      beforeInline,
      afterInline,
      afterInlineMs,
      inlineChanged: afterInline !== beforeInline && Boolean(afterInline),
      slideStartMs: afterInlineMs,
      firstComputedFrameMs: firstChangedFrame?.ms ?? null,
      earlyFrames,
      marks,
      msToAfterVisual: marks?.msToAfterVisual ?? null,
      msHandlerState: marks?.msToAfterState ?? null,
      msHandlerUrl: marks?.msToAfterUrl ?? null,
      carouselIndexVia: marks?.carouselIndexVia ?? null,
    }
  }, label)
}

const cold = await measureTap('Predictions')
await page.waitForTimeout(400)
const warmBack = await measureTap('Home')
await page.waitForTimeout(400)
const skip = await measureTap('Leaderboard')
await page.waitForTimeout(400)
const toPred = await measureTap('Predictions')

// Network activity during a tap (RSC?)
const net = []
page.on('request', (req) => {
  if (req.url().includes('/pool/') || req.url().includes('_rsc') || req.url().includes('?_rsc')) {
    net.push({ url: req.url().slice(0, 120), type: req.resourceType() })
  }
})
await measureTap('Home')
await page.waitForTimeout(300)

const desktop = await (async () => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${baseUrl}/pool/${invite}?tab=predictions`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(700)
  return page.evaluate(() => ({
    hasCarousel: Boolean(document.querySelector('[data-pool-tab-carousel]')),
  }))
})()

await browser.close()

const report = {
  phase: PHASE,
  mountBefore,
  timings: { cold, warmBack, skip, toPred },
  netAfterTap: net,
  desktop,
  diagnosisHint: {
    ifMsToCarouselEffectNearFirstVisual:
      'Slide gated on useEffect(activeTab)→setCarouselIndex (post-paint).',
    ifHandlerUrlHuge: 'URL sync blocking in tap handler.',
    ifFirstVisualHugeButHandlerTiny:
      'React commit/re-render of heavy panes before transform paint.',
    ifPanesEmptyPreTap: 'Lazy mount despite keep-mounted claim.',
  },
}

writeFileSync(
  resolve(outDir, `pool-tab-timing-${PHASE}.json`),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
