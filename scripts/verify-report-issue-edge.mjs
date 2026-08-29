/**
 * Inspect real logged-in Report Issue tactile edge (before/after).
 * Usage: node scripts/verify-report-issue-edge.mjs [before|after]
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })

const phase = process.argv[2] === 'after' ? 'after' : 'before'
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

async function authCookies() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 20 })
  const user = list.users.find((u) => u.email)
  if (!user?.email) throw new Error('no user with email')
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
        user,
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
await context.addCookies(await authCookies())
const page = await context.newPage()
await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1200)

const btn = page.getByRole('button', { name: /report issue/i }).first()
await btn.waitFor({ state: 'visible', timeout: 20000 })

const metrics = await btn.evaluate((el) => {
  const cs = getComputedStyle(el)
  const shadow = cs.boxShadow
  // Parse first rgba/rgb/color() from box-shadow for the edge color
  const colorMatch =
    shadow.match(/rgba?\([^)]+\)/) ||
    shadow.match(/color\([^)]+\)/) ||
    shadow.match(/#[0-9a-fA-F]{3,8}/)
  return {
    className: el.className,
    surface: cs.getPropertyValue('--tactile-btn-surface').trim(),
    edgeVar: cs.getPropertyValue('--tactile-btn-edge').trim(),
    destructiveToken: cs.getPropertyValue('--destructive').trim(),
    primaryToken: cs.getPropertyValue('--primary').trim(),
    boxShadow: shadow,
    shadowColorParsed: colorMatch ? colorMatch[0] : null,
    backgroundImage: cs.backgroundImage.slice(0, 160),
    backgroundColor: cs.backgroundColor,
    color: cs.color,
  }
})

const restShot = resolve(outDir, `report-issue-edge-${phase}-rest-1440x900.png`)
const box = await btn.boundingBox()
await page.screenshot({
  path: restShot,
  clip: {
    x: Math.max(0, box.x - 16),
    y: Math.max(0, box.y - 16),
    width: box.width + 32,
    height: box.height + 40,
  },
})

await btn.hover()
await page.mouse.down()
await page.waitForTimeout(250)
const pressedMetrics = await btn.evaluate((el) => {
  const cs = getComputedStyle(el)
  return {
    boxShadow: cs.boxShadow,
    transform: cs.transform,
    edgeVar: cs.getPropertyValue('--tactile-btn-edge').trim(),
  }
})
const pressedShot = resolve(outDir, `report-issue-edge-${phase}-pressed-1440x900.png`)
await page.screenshot({
  path: pressedShot,
  clip: {
    x: Math.max(0, box.x - 16),
    y: Math.max(0, box.y - 16),
    width: box.width + 32,
    height: box.height + 40,
  },
})
await page.mouse.up()

const report = { phase, metrics, pressedMetrics, restShot, pressedShot }
writeFileSync(
  resolve(outDir, `report-issue-edge-${phase}.json`),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
await browser.close()
