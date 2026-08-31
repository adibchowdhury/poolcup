import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const poolPath = '/pool/afcaad5c?tab=leaderboard'
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
  if (!verified.data.session) throw new Error(verified.error?.message ?? 'no session')
  const { access_token, refresh_token } = verified.data.session
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
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

async function probe(page, viewport) {
  await page.setViewportSize(viewport)
  await page.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1800)
  return page.evaluate(() => {
    const header = document.querySelector('header[aria-label="Pool page header"]')
    const headerInner = header?.firstElementChild
    const podium = document.querySelector('.leaderboard-podium-stadium')
    const table = document.querySelector('section[aria-label="Full standings"]')
    const tableCard = table?.firstElementChild
    const headerRow = [...document.querySelectorAll('[role="row"]')].find((el) =>
      /Exact/i.test(el.textContent || ''),
    )
    const shareMyRank = [...document.querySelectorAll('button')].some((b) =>
      /share my rank/i.test(b.textContent || ''),
    )
    const topShare = [...(header?.querySelectorAll('button') ?? [])].some((b) =>
      /^share$/i.test((b.textContent || '').trim()),
    )
    const actions = [...(header?.querySelectorAll('button') ?? [])].map((b) =>
      (b.textContent || '').replace(/\s+/g, ' ').trim(),
    )
    function contentBox(el) {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        left: r.left + parseFloat(cs.paddingLeft || '0'),
        right: r.right - parseFloat(cs.paddingRight || '0'),
      }
    }
    function box(el) {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right }
    }
    const headerContent = contentBox(headerInner)
    const podiumBox = box(podium)
    const tableBox = box(tableCard)
    const edgeDelta = (a, b) =>
      a && b
        ? {
            left: Math.round(Math.abs(a.left - b.left) * 10) / 10,
            right: Math.round(Math.abs(a.right - b.right) * 10) / 10,
          }
        : null
    return {
      headerText: headerRow?.textContent?.replace(/\s+/g, ' ').trim()?.slice(0, 160) ?? null,
      shareMyRankPresent: shareMyRank,
      topSharePresent: topShare,
      actionLabels: actions,
      edges: {
        headerVsPodium: edgeDelta(headerContent, podiumBox),
        headerVsTable: edgeDelta(headerContent, tableBox),
        podiumVsTable: edgeDelta(podiumBox, tableBox),
      },
      sampleLastPick: [...document.querySelectorAll('li span[title="Temporary mock last pick"]')]
        .slice(0, 3)
        .map((el) => el.textContent?.trim()),
    }
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
  const ctx = await browser.newContext()
  await ctx.addCookies(await authAs(creatorId))
  const page = await ctx.newPage()
  const results = {}
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    const data = await probe(page, vp)
    const shot = resolve(outDir, `leaderboard-adjust-${vp.width}x${vp.height}.png`)
    await page.screenshot({ path: shot, fullPage: false })
    results[`${vp.width}x${vp.height}`] = { ...data, shot }
  }
  writeFileSync(resolve(outDir, 'leaderboard-adjust-report.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
