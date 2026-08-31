import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
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
  if (!verified.data.session)
    throw new Error(verified.error?.message ?? 'no session')
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

async function probe(page, tab) {
  await page.goto(`${baseUrl}/pool/afcaad5c?tab=${tab}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1800)
  return page.evaluate(() => {
    const header = document.querySelector(
      'header[aria-label="Pool page header"]',
    )
    const aside = document.querySelector('aside')
    const actions = [...(header?.querySelectorAll('button') ?? [])].map((b) =>
      (b.textContent || '').replace(/\s+/g, ' ').trim(),
    )
    const headerInner = header?.firstElementChild
    const hr = headerInner?.getBoundingClientRect()
    const asideR = aside?.getBoundingClientRect()
    const labels = [...(aside?.querySelectorAll('p') ?? [])]
      .slice(0, 6)
      .map((p) => (p.textContent || '').trim())
      .filter(Boolean)
    return {
      headerVisible: Boolean(
        header && getComputedStyle(header).display !== 'none',
      ),
      asideWidth: asideR ? Math.round(asideR.width) : null,
      headerHeight: hr ? Math.round(hr.height) : null,
      actions,
      sidebarLabels: labels,
      hasStatusFilters: /Unpicked|Predicted|All/i.test(aside?.textContent || ''),
      hasCommissionerCta: /Make your pool standout/i.test(
        aside?.textContent || '',
      ),
    }
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  await ctx.addCookies(await authAs('f72fddaa-f63f-4bc5-9157-e919919709a1'))
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })

  const leaderboard = await probe(page, 'leaderboard')
  const shotLb = resolve(outDir, 'shell-parity-leaderboard-1440x900.png')
  await page.screenshot({ path: shotLb, fullPage: false })

  const predictions = await probe(page, 'predictions')
  const shotPred = resolve(outDir, 'shell-parity-predictions-1440x900.png')
  await page.screenshot({ path: shotPred, fullPage: false })

  // Short viewport compress check on predictions
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`${baseUrl}/pool/afcaad5c?tab=predictions`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(1200)
  const fit = await page.evaluate(() => {
    const aside = document.querySelector('aside')
    return {
      asideScrollDelta: aside
        ? Math.max(0, aside.scrollHeight - aside.clientHeight)
        : null,
      asideOverflow: aside ? getComputedStyle(aside).overflowY : null,
      ctaCompact: Boolean(
        aside?.querySelector('img[src*="pucky"]') &&
          aside.querySelector('img[src*="pucky"]')?.getBoundingClientRect()
            .height < 80,
      ),
    }
  })
  const shotFit = resolve(outDir, 'shell-predictions-fit-1280x800.png')
  await page.screenshot({ path: shotFit, fullPage: false })

  const report = {
    leaderboard: { ...leaderboard, shot: shotLb },
    predictions: { ...predictions, shot: shotPred },
    fit1280x800: { ...fit, shot: shotFit },
    parity: {
      asideWidthMatch: leaderboard.asideWidth === predictions.asideWidth,
      headerHeightMatch: leaderboard.headerHeight === predictions.headerHeight,
      actionsMatch:
        JSON.stringify(leaderboard.actions) ===
        JSON.stringify(predictions.actions),
    },
  }
  writeFileSync(
    resolve(outDir, 'shell-parity-report.json'),
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
