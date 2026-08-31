import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const creatorId = 'f72fddaa-f63f-4bc5-9157-e919919709a1'
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'

async function authCookies() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: got, error } = await admin.auth.admin.getUserById(creatorId)
  if (error || !got.user?.email) throw new Error(error?.message ?? 'no user')
  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: got.user.email,
  })
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const verified = await anon.auth.verifyOtp({
    email: got.user.email,
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
          id: got.user.id,
          email: got.user.email,
          aud: got.user.aud,
          role: got.user.role,
          app_metadata: {},
          user_metadata: {},
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

async function main() {
  const missing = new Set()
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  await ctx.addCookies(await authCookies())
  const page = await ctx.newPage()
  page.on('response', (res) => {
    if (res.status() !== 404) return
    const u = res.url()
    if (
      u.includes('/avatars/') ||
      u.includes('/badges/') ||
      u.includes('/flags/') ||
      u.includes('/mascot/') ||
      u.includes('/pool_avatars/') ||
      u.includes('/sports/') ||
      /\.(png|jpg|jpeg|webp|svg|gif)(\?|$)/i.test(u)
    ) {
      missing.add(u.replace(baseUrl, ''))
    }
  })

  for (const path of [
    '/dashboard',
    '/achievements',
    '/pool/afcaad5c?tab=leaderboard',
    '/pool/afcaad5c?tab=predictions',
  ]) {
    await page.goto(`${baseUrl}${path}`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await page.waitForTimeout(2000)
  }

  console.log(JSON.stringify([...missing].sort(), null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
