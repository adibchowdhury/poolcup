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

function extractMeta(html) {
  const get = (re) => {
    const m = html.match(re)
    return m?.[1]?.replace(/&amp;/g, '&') ?? null
  }
  return {
    title: get(/<title>([^<]*)<\/title>/i),
    description: get(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    ) ?? get(
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    ),
    canonical: get(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i,
    ) ?? get(
      /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i,
    ),
    ogTitle: get(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
    ),
    ogDescription: get(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    ),
    ogType: get(
      /<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']*)["']/i,
    ),
    robots: get(
      /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i,
    ),
    hasH1: /<h1[^>]*>[\s\S]*?NFL Pick/i.test(html),
    primaryHref: get(
      /href=["']([^"']*)["'][^>]*>[\s\S]*?Create Your NFL Pick/i,
    ) ?? (html.includes('/login?next=/create') ? '/login?next=/create' : null),
    secondaryHref: html.includes('>Sign in<')
      ? (html.match(/href=["'](\/login)["'][^>]*>[\s\S]*?Sign in/)?.[1] ??
        '/login')
      : null,
  }
}

async function curlMeta(path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'text/html' },
    redirect: 'manual',
  })
  const html = await res.text()
  return { status: res.status, ...extractMeta(html), path }
}

const loggedOut = {
  nfl: await curlMeta('/nfl-pick-em'),
  home: await curlMeta('/'),
  pricing: await curlMeta('/pricing'),
}

const browser = await chromium.launch({ headless: true })

// Logged-out screenshots
const ctxOut = await browser.newContext({
  viewport: { width: 390, height: 844 },
})
const pageOut = await ctxOut.newPage()
await pageOut.goto(`${baseUrl}/nfl-pick-em`, {
  waitUntil: 'networkidle',
  timeout: 60000,
})
const shot390 = resolve(outDir, 'nfl-pick-em-logged-out-390.png')
await pageOut.screenshot({ path: shot390, fullPage: false })

await pageOut.setViewportSize({ width: 1440, height: 900 })
await pageOut.waitForTimeout(300)
const shot1440 = resolve(outDir, 'nfl-pick-em-logged-out-1440.png')
await pageOut.screenshot({ path: shot1440, fullPage: false })

const primaryHref = await pageOut
  .getByRole('link', { name: /Create Your NFL Pick/i })
  .getAttribute('href')
const secondaryHref = await pageOut
  .getByLabel("NFL Pick'em", { exact: true })
  .getByRole('link', { name: /^Sign in$/i })
  .getAttribute('href')

// Logged-out: follow primary → should land on login
await pageOut.getByRole('link', { name: /Create Your NFL Pick/i }).click()
await pageOut.waitForURL(/\/login/, { timeout: 15000 })
const loggedOutPrimaryUrl = pageOut.url()

await ctxOut.close()

// Logged-in: primary should still be /login?next=/create (landing convention);
// following it may stay on login or bounce — report what happens. Also try /create.
const ctxIn = await browser.newContext({
  viewport: { width: 390, height: 844 },
})
await ctxIn.addCookies(await authAs(creatorId))
const pageIn = await ctxIn.newPage()
await pageIn.goto(`${baseUrl}/nfl-pick-em`, {
  waitUntil: 'networkidle',
  timeout: 60000,
})
const loggedInPrimaryHref = await pageIn
  .getByRole('link', { name: /Create Your NFL Pick/i })
  .getAttribute('href')
await pageIn.getByRole('link', { name: /Create Your NFL Pick/i }).click()
await pageIn.waitForTimeout(2000)
const loggedInAfterPrimary = pageIn.url()

// Direct /create while logged in should work
await pageIn.goto(`${baseUrl}/create`, {
  waitUntil: 'networkidle',
  timeout: 60000,
})
const loggedInCreateUrl = pageIn.url()

await browser.close()

const report = {
  comingSoonMode: process.env.COMING_SOON_MODE ?? '(unset)',
  curl: loggedOut,
  cta: {
    primaryHref,
    secondaryHref,
    loggedOutPrimaryUrl,
    loggedInPrimaryHref,
    loggedInAfterPrimary,
    loggedInCreateUrl,
  },
  shots: { shot390, shot1440 },
}

writeFileSync(
  resolve(outDir, 'nfl-pick-em-phase1-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
