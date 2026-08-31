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
  await page.waitForTimeout(2000)
  return page.evaluate((which) => {
    const aside = document.querySelector('aside')
    const header = document.querySelector(
      'header[aria-label="Pool page header"]',
    )
    const actions = [...(header?.querySelectorAll('button') ?? [])].map((b) =>
      (b.textContent || '').replace(/\s+/g, ' ').trim(),
    )
    const labels = [...(aside?.querySelectorAll('p') ?? [])]
      .map((p) => (p.textContent || '').trim())
      .filter((t) =>
        /^(Pool|Pool info|Recent activity|Status|Sort)$/i.test(t),
      )
    const grid = [...document.querySelectorAll('section[aria-label] div.grid')]
      .map((el) => getComputedStyle(el).gridTemplateColumns)
      .find((g) => g && g.split(' ').length >= 3)
    const vsCount = [...document.querySelectorAll('article span')].filter(
      (s) => (s.textContent || '').trim().toLowerCase() === 'vs',
    ).length
    const filterRow = [...document.querySelectorAll('[role="tablist"]')].find(
      (el) => /Unpicked|All/i.test(el.textContent || ''),
    )
    const filterVisible =
      filterRow && getComputedStyle(filterRow).display !== 'none'
    return {
      tab: which,
      asideWidth: aside ? Math.round(aside.getBoundingClientRect().width) : null,
      actions,
      sidebarSectionLabels: labels,
      gridTemplateColumns: grid ?? null,
      gridColCount: grid ? grid.split(' ').filter(Boolean).length : null,
      vsLabelsVisible: vsCount,
      statusFilterInMain: Boolean(filterVisible),
      hasPoolInfo: /Pool info/i.test(aside?.textContent || ''),
      hasFiltersInAside: /Unpicked/i.test(aside?.textContent || ''),
      asideScrollDelta: aside
        ? Math.max(0, aside.scrollHeight - aside.clientHeight)
        : null,
    }
  }, tab)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  await ctx.addCookies(await authAs('f72fddaa-f63f-4bc5-9157-e919919709a1'))
  const page = await ctx.newPage()

  const results = {}
  for (const vp of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(vp)
    const lb = await probe(page, 'leaderboard')
    const shotLb = resolve(
      outDir,
      `shell-shared-${vp.width}x${vp.height}-leaderboard.png`,
    )
    await page.screenshot({ path: shotLb, fullPage: false })

    const pred = await probe(page, 'predictions')
    const shotPred = resolve(
      outDir,
      `shell-shared-${vp.width}x${vp.height}-predictions.png`,
    )
    await page.screenshot({ path: shotPred, fullPage: false })

    results[`${vp.width}x${vp.height}`] = {
      leaderboard: { ...lb, shot: shotLb },
      predictions: { ...pred, shot: shotPred },
      parity: {
        asideWidth: lb.asideWidth === pred.asideWidth,
        actions: JSON.stringify(lb.actions) === JSON.stringify(pred.actions),
        bothHavePoolInfo: lb.hasPoolInfo && pred.hasPoolInfo,
        filtersNotInAside: !pred.hasFiltersInAside,
      },
    }
  }

  writeFileSync(
    resolve(outDir, 'shell-shared-card-report.json'),
    JSON.stringify(results, null, 2),
  )
  console.log(JSON.stringify(results, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
