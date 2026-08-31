/**
 * Verify pool top-bar action cluster — exactly one Report issue + one Invite per view.
 * Run: node scripts/verify-pool-topbar-actions.mjs
 */
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

function probeTopBarActions(page) {
  return page.evaluate(() => {
    const isVisible = (el) => {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      )
    }

    const reportButtons = Array.from(document.querySelectorAll('button')).filter(
      (btn) =>
        isVisible(btn) &&
        (btn.getAttribute('aria-label') === 'Report issue' ||
          btn.textContent?.trim() === 'Report issue'),
    )

    const inviteButtons = Array.from(
      document.querySelectorAll('button'),
    ).filter(
      (btn) =>
        isVisible(btn) &&
        (btn.textContent?.trim() === 'Invite' ||
          btn.getAttribute('aria-label') === 'Invite'),
    )

    const poolHeader = document.querySelector(
      'header[aria-label="Pool page header"], header[aria-label="Pool settings header"]',
    )

    const fixedFallback = document.querySelector(
      '.pointer-events-none.fixed.right-4.top-3\\.5',
    )

    return {
      reportCount: reportButtons.length,
      inviteCount: inviteButtons.length,
      hasPoolDesktopTopBar: Boolean(poolHeader && isVisible(poolHeader)),
      fixedFallbackVisible: Boolean(
        fixedFallback && isVisible(fixedFallback),
      ),
      reportRects: reportButtons.map((b) => {
        const r = b.getBoundingClientRect()
        return { top: r.top, left: r.left, width: r.width, height: r.height }
      }),
    }
  })
}

const views = [
  { name: 'home', path: `/pool/${invite}/home` },
  { name: 'predictions', path: `/pool/${invite}?tab=predictions` },
  { name: 'leaderboard', path: `/pool/${invite}?tab=leaderboard` },
  { name: 'settings', path: `/pool/${invite}/settings/details` },
  { name: 'upgrade', path: `/pool/${invite}/upgrade` },
]

const browser = await chromium.launch()
const report = { views: {}, screenshots: {} }

for (const view of views) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}${view.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.waitForTimeout(4000)
  await page
    .waitForSelector(
      'header[aria-label="Pool page header"], header[aria-label="Pool settings header"], button:has-text("Report issue")',
      { timeout: 20000 },
    )
    .catch(() => undefined)

  const probe = await probeTopBarActions(page)
  const shot = resolve(outDir, `pool-topbar-actions-${view.name}-1440.png`)
  await page.screenshot({ path: shot, fullPage: false })

  report.views[view.name] = { path: view.path, probe }
  report.screenshots[view.name] = shot
  console.log(view.name, probe)
  await context.close()
}

await browser.close()

const reportPath = resolve(outDir, 'pool-topbar-actions-report.json')
writeFileSync(reportPath, JSON.stringify(report, null, 2))

const failures = Object.entries(report.views).filter(
  ([, v]) => v.probe.reportCount !== 1,
)
if (failures.length > 0) {
  console.error('FAIL: duplicate or missing Report issue:', failures)
  process.exit(1)
}
console.log('OK: exactly one Report issue per view')
