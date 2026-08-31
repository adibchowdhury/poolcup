/**
 * Pool Home 3-column layout — screenshots at 1440 + 390.
 * Run: node scripts/verify-pool-home-content.mjs
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
const activeInvite = '617c79ba'

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

async function findCompletedPoolInvite(admin, userId) {
  const { data: pools } = await admin
    .from('pools')
    .select('invite_code, name, id, event_id, scoring_style')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  const candidates = []

  for (const pool of pools ?? []) {
    if (!pool.event_id) continue
    if (pool.scoring_style === 'winner') continue
    const { count: total } = await admin
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', pool.event_id)
    const { count: played } = await admin
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', pool.event_id)
      .eq('is_final', true)
    if (total > 0 && played === total) {
      candidates.push({
        invite: pool.invite_code,
        name: pool.name,
        matchesPlayed: played,
        totalMatches: total,
        scoringStyle: pool.scoring_style,
      })
    }
  }

  return candidates[0] ?? null
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const completed = await findCompletedPoolInvite(admin, creatorId)
const report = {
  activePool: { invite: activeInvite, path: `/pool/${activeInvite}/home` },
  completedPool: completed,
  screenshots: {},
}

const browser = await chromium.launch()

async function capture(label, path, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
  })
  await context.addCookies(await authAs(creatorId))
  const page = await context.newPage()
  await page.goto(`${baseUrl}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.waitForTimeout(5000)
  await page
    .waitForSelector('text=Next up, text=Tournament complete, text=Your standing', {
      timeout: 15000,
    })
    .catch(() => undefined)
  const file = resolve(outDir, `pool-home-${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  await context.close()
  return file
}

report.screenshots.active1440 = await capture(
  'active-1440',
  `/pool/${activeInvite}/home`,
  1440,
  900,
)
report.screenshots.active390 = await capture(
  'active-390',
  `/pool/${activeInvite}?tab=home`,
  390,
  844,
)

if (completed?.invite) {
  report.screenshots.completed1440 = await capture(
    'completed-1440',
    `/pool/${completed.invite}/home`,
    1440,
    900,
  )
  report.screenshots.completed390 = await capture(
    'completed-390',
    `/pool/${completed.invite}?tab=home`,
    390,
    844,
  )
}

await browser.close()

const reportPath = resolve(outDir, 'pool-home-content-report.json')
writeFileSync(reportPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
