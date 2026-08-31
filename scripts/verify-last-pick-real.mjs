import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })

const poolId = 'f407e0c6-55bb-4fe1-ab17-78536956e667'
const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

async function authCookies() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: got, error } = await admin.auth.admin.getUserById(creatorId)
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

async function dbProbe() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { count: memberCount } = await admin
    .from('pool_members')
    .select('id', { count: 'exact', head: true })
    .eq('pool_id', poolId)
  const { count: predCount } = await admin
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('pool_id', poolId)
    .not('pred_team1', 'is', null)
    .not('pred_team2', 'is', null)

  // Same shape as fetchPoolMembersLastPicks
  const { data, error } = await admin
    .from('predictions')
    .select(
      `
      member_id,
      pred_team1,
      pred_team2,
      submitted_at,
      matches (
        team1_name,
        team2_name,
        team1_flag,
        team2_flag,
        team1_logo,
        team2_logo
      )
    `,
    )
    .eq('pool_id', poolId)
    .not('pred_team1', 'is', null)
    .not('pred_team2', 'is', null)
    .order('submitted_at', { ascending: false })

  const lastByMember = new Map()
  for (const raw of data ?? []) {
    if (lastByMember.has(raw.member_id)) continue
    const matchRaw = raw.matches
    const match = Array.isArray(matchRaw) ? matchRaw[0] : matchRaw
    if (!match) continue
    lastByMember.set(raw.member_id, {
      score: `${raw.pred_team1}–${raw.pred_team2}`,
      teams: `${match.team1_name} vs ${match.team2_name}`,
    })
  }

  return {
    memberCount,
    predCount,
    lastPickMembers: lastByMember.size,
    sample: [...lastByMember.values()].slice(0, 3),
    queryError: error?.message ?? null,
  }
}

async function main() {
  const db = await dbProbe()
  console.log('db', JSON.stringify(db, null, 2))

  const consoleErrors = []
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  await ctx.addCookies(await authCookies())
  const page = await ctx.newPage()
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    consoleErrors.push(text)
  })

  await page.goto(`${baseUrl}/pool/afcaad5c?tab=leaderboard`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  await page.waitForTimeout(3500)

  const ui = await page.evaluate(() => {
    const rows = [
      ...document.querySelectorAll(
        'li[class*="grid"], [class*="leaderboard"] li, ol li, ul li',
      ),
    ]
    // Last Pick cells: scoreline with mono score like "2–1" plus flag imgs
    const scorelines = [...document.querySelectorAll('span')].filter((el) => {
      const t = (el.textContent || '').trim()
      return /^\d+–\d+$/.test(t) && el.className.includes('font-mono')
    })
    const flagImgs = [...document.querySelectorAll('img')].filter((img) => {
      const src = img.getAttribute('src') || ''
      return src.includes('/flags/') || src.includes('flags')
    })
    const empties = [...document.querySelectorAll('[aria-label="No predictions"]')]
      .length
    return {
      scorelineCount: scorelines.length,
      sampleScores: scorelines.slice(0, 5).map((el) => el.textContent?.trim()),
      flagImgCount: flagImgs.length,
      emptyLastPickCount: empties,
    }
  })

  await page.screenshot({
    path: resolve(outDir, 'leaderboard-last-pick-real-1440.png'),
  })

  const breakdownErrors = consoleErrors.filter((t) =>
    /Leaderboard breakdown totals/i.test(t),
  )

  console.log(
    JSON.stringify(
      {
        ui,
        breakdownErrorCount: breakdownErrors.length,
        breakdownErrors,
        otherConsoleErrors: consoleErrors
          .filter((t) => !/Leaderboard breakdown totals/i.test(t))
          .slice(0, 8),
      },
      null,
      2,
    ),
  )

  await browser.close()

  if (db.lastPickMembers < 15) {
    console.error('FAIL: expected last picks for 15 members, got', db.lastPickMembers)
    process.exitCode = 1
  }
  if (breakdownErrors.length > 0) {
    console.error('FAIL: breakdown totals console error still fires')
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
