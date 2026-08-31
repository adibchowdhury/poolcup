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
  await page.waitForTimeout(2200)
  return page.evaluate(() => {
    const aside = document.querySelector('aside[aria-label="Pool navigation and info"]')
    const header = document.querySelector('header[aria-label="Pool page header"]')
    const headerRow = [...document.querySelectorAll('[role="row"]')].find((el) =>
      /Last Pick/i.test(el.textContent || ''),
    )
    const flagImgs = [
      ...document.querySelectorAll(
        'section[aria-label="Full standings"] img[src*="/flags/"]',
      ),
    ]
    const exactHeader = /Exact/i.test(headerRow?.textContent || '')
    const activityItems = aside
      ? [...aside.querySelectorAll('ul li')].filter((li) =>
          /moved|dropped|joined/i.test(li.textContent || ''),
        ).length
      : 0
    const sidebarScroll =
      aside != null &&
      (aside.scrollHeight > aside.clientHeight + 1 ||
        aside.querySelector('.overflow-hidden')?.scrollHeight >
          aside.clientHeight + 40)
    const avatar = header?.querySelector('img, [class*="avatar"]')
    const avatarBox = avatar?.getBoundingClientRect()
    const actions = [...(header?.querySelectorAll('button') ?? [])].map((b) => {
      const r = b.getBoundingClientRect()
      return {
        label: (b.textContent || '').replace(/\s+/g, ' ').trim(),
        h: Math.round(r.height),
      }
    })
    const labels = [...(aside?.querySelectorAll('p') ?? [])]
      .filter((p) => /^(Pool|Pool info|Recent activity)$/i.test((p.textContent || '').trim()))
      .map((p) => {
        const section = p.parentElement
        const next = p.nextElementSibling
        return {
          label: (p.textContent || '').trim(),
          labelLeft: Math.round(p.getBoundingClientRect().left),
          contentLeft: next
            ? Math.round(next.getBoundingClientRect().left)
            : null,
          sectionPad: section ? getComputedStyle(section).paddingLeft : null,
        }
      })
    const logoSep = Boolean(
      aside
        ?.querySelector('.border-t')
        ?.previousElementSibling?.querySelector('a, img'),
    )
    return {
      headerText: headerRow?.textContent?.replace(/\s+/g, ' ').trim()?.slice(0, 120) ?? null,
      exactHeaderPresent: exactHeader,
      flagImageCount: flagImgs.length,
      sampleFlagSrcs: flagImgs.slice(0, 4).map((img) => img.getAttribute('src')),
      activityItems,
      asideOverflowY: aside ? getComputedStyle(aside).overflowY : null,
      asideScrollDelta: aside
        ? Math.max(0, aside.scrollHeight - aside.clientHeight)
        : null,
      avatarH: avatarBox ? Math.round(avatarBox.height) : null,
      actions,
      labels,
      logoSeparatorLikely: logoSep,
      confettiCanvas: Boolean(
        document.querySelector('.leaderboard-podium-stadium__confetti canvas'),
      ),
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
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    const data = await probe(page, vp)
    const shot = resolve(outDir, `leaderboard-refine-${vp.width}x${vp.height}.png`)
    await page.screenshot({ path: shot, fullPage: false })
    results[`${vp.width}x${vp.height}`] = { ...data, shot }
  }
  writeFileSync(
    resolve(outDir, 'leaderboard-refine-report.json'),
    JSON.stringify(results, null, 2),
  )
  console.log(JSON.stringify(results, null, 2))
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
