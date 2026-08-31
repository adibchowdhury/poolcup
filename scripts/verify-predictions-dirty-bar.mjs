import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })

const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })
const matchId = 'f42dd2f5-2fc2-4b71-881d-f9ec916287e4'
const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function authCookies() {
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

async function saveBarState(page) {
  return page.evaluate(() => {
    const saveBtn = [...document.querySelectorAll('button')].find((b) =>
      /Save predictions|Saved|Saving/i.test((b.textContent || '').trim()),
    )
    const fixed = saveBtn?.closest('div.fixed')
    return {
      opacity: fixed ? parseFloat(getComputedStyle(fixed).opacity) : null,
      pointerEvents: fixed ? getComputedStyle(fixed).pointerEvents : null,
      text: saveBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      groups: [...document.querySelectorAll('button[aria-expanded]')]
        .filter((b) =>
          /Collapse|Expand/i.test(b.getAttribute('aria-label') || ''),
        )
        .map((b) => ({
          label: b.querySelector('h2')?.textContent?.trim(),
          expanded: b.getAttribute('aria-expanded') === 'true',
        })),
    }
  })
}

async function main() {
  const { data: before } = await admin
    .from('matches')
    .select(
      'kickoff_at,locked_at,status_short,is_final,result_team1,result_team2',
    )
    .eq('id', matchId)
    .single()

  const future = new Date(Date.now() + 7 * 86400000).toISOString()
  await admin
    .from('matches')
    .update({
      kickoff_at: future,
      locked_at: future,
      status_short: 'NS',
      is_final: false,
      result_team1: null,
      result_team2: null,
    })
    .eq('id', matchId)
  console.log('unlocked', matchId)

  try {
    const cookies = await authCookies()
    const browser = await chromium.launch({ headless: true })

    for (const { name, size } of [
      { name: '1280', size: { width: 1280, height: 800 } },
      { name: '1440', size: { width: 1440, height: 900 } },
    ]) {
      const context = await browser.newContext({ viewport: size })
      await context.addCookies(cookies)
      const page = await context.newPage()
      await page.goto('http://localhost:3000/pool/afcaad5c?tab=predictions', {
        waitUntil: 'networkidle',
        timeout: 90000,
      })
      await page.waitForTimeout(2500)

      const clean = await saveBarState(page)
      await page.screenshot({
        path: resolve(outDir, `predictions-refine-${name}-clean.png`),
      })

      // Expand every collapsed date group so the unlocked match is reachable
      const collapsed = page.locator(
        'button[aria-expanded="false"][aria-label^="Expand"]',
      )
      const collapsedCount = await collapsed.count()
      for (let i = 0; i < collapsedCount; i++) {
        await collapsed.nth(0).click()
        await page.waitForTimeout(200)
      }

      const probe = await page.evaluate(() => {
        const inputs = [
          ...document.querySelectorAll(
            '.pool-predictions-desktop-grid input[inputmode="numeric"]',
          ),
        ]
        return inputs.map((el) => {
          const cs = getComputedStyle(el)
          const r = el.getBoundingClientRect()
          return {
            label: el.getAttribute('aria-label'),
            disabled: el.disabled,
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity,
            w: r.width,
            h: r.height,
            top: r.top,
          }
        })
      })
      console.log('inputProbe', name, JSON.stringify(probe.slice(0, 6)))

      const input = page.locator(
        '.pool-predictions-desktop-grid input[inputmode="numeric"]:not([disabled])',
      )
      // Prefer geometrically visible inputs (desktop anatomy; zero-size clones exist)
      const total = await input.count()
      let filled = false
      for (let i = 0; i < total; i++) {
        const box = await input.nth(i).boundingBox()
        if (!box || box.width < 8 || box.height < 8) continue
        await input.nth(i).click({ force: true })
        await input.nth(i).fill('')
        await input.nth(i).type('4', { delay: 40 })
        filled = true
        break
      }
      const n = filled ? 1 : 0
      await page.waitForTimeout(800)
      const dirty = await saveBarState(page)
      await page.screenshot({
        path: resolve(outDir, `predictions-refine-${name}-dirty.png`),
      })
      console.log(JSON.stringify({ viewport: name, editable: n, clean, dirty }, null, 2))
      await context.close()
    }

    await browser.close()
  } finally {
    await admin
      .from('matches')
      .update({
        kickoff_at: before.kickoff_at,
        locked_at: before.locked_at,
        status_short: before.status_short,
        is_final: before.is_final,
        result_team1: before.result_team1,
        result_team2: before.result_team2,
      })
      .eq('id', matchId)
    console.log('reverted match')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
