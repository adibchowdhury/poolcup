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
  viewport: { width: 1440, height: 900 },
})
await context.addCookies(await authAs(creatorId))
const page = await context.newPage()
await page.goto(`${baseUrl}/pool/afcaad5c?tab=predictions`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(1500)

const probe = await page.evaluate(() => {
  const headers = [...document.querySelectorAll('button[aria-expanded]')].map(
    (btn) => ({
      expanded: btn.getAttribute('aria-expanded'),
      text: (btn.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 180),
    }),
  )
  const stageTabs = Boolean(
    document.querySelector('[aria-label="Tournament round"]'),
  )
  return { headers, stageTabs, headerCount: headers.length }
})

const landing = resolve(outDir, 'predictions-ended-stages-landing-1440.png')
await page.screenshot({ path: landing, fullPage: false })

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button[aria-expanded]')].find(
    (el) => /group stage/i.test(el.textContent || ''),
  )
  btn?.click()
})
await page.waitForTimeout(700)

const expanded = resolve(
  outDir,
  'predictions-ended-stages-group-expanded-1440.png',
)
await page.screenshot({ path: expanded, fullPage: false })

const afterExpand = await page.evaluate(() => {
  return [...document.querySelectorAll('button[aria-expanded]')].map((btn) => ({
    expanded: btn.getAttribute('aria-expanded'),
    text: (btn.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 180),
  }))
})

const report = { ...probe, afterExpand, landing, expanded }
writeFileSync(
  resolve(outDir, 'predictions-ended-stages-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
await browser.close()
