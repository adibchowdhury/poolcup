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
const invite = '617c79ba'

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
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})
await context.addCookies(await authAs(creatorId))
const page = await context.newPage()
await page.goto(`${baseUrl}/pool/${invite}?tab=home`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(1000)

const beforeOpen = await page.evaluate(() => {
  const nudge = Array.from(document.querySelectorAll('div, section')).find(
    (el) => el.textContent?.includes("This pool's quiet"),
  )
  // find the nudge card's parent padded wrapper
  let el = nudge
  while (el && el !== document.body) {
    const pl = getComputedStyle(el).paddingLeft
    if (pl === '16px') break
    el = el.parentElement
  }
  const mainTop = document.querySelector('main')?.getBoundingClientRect().top
  return {
    nudgePadLeft: el ? getComputedStyle(el).paddingLeft : null,
    contentShiftY: mainTop,
  }
})

await page.click('button[aria-label="Pool options"]')
await page.waitForTimeout(400)

const openProbe = await page.evaluate(() => {
  const menu = document.querySelector('[data-slot="dropdown-menu-content"]')
  const trigger = document.querySelector('button[aria-label="Pool options"]')
  const cs = menu ? getComputedStyle(menu) : null
  const mr = menu?.getBoundingClientRect()
  const tr = trigger?.getBoundingClientRect()
  const items = Array.from(
    menu?.querySelectorAll('[data-slot="dropdown-menu-item"]') ?? [],
  ).map((el) => {
    const svg = el.querySelector('svg')
    return {
      text: el.textContent?.replace(/\s+/g, ' ').trim(),
      color: getComputedStyle(el).color,
      iconColor: svg ? getComputedStyle(svg).color : null,
    }
  })
  const caret = menu?.querySelector('span[aria-hidden].rotate-45')
  return {
    menuBg: cs?.backgroundColor,
    menuBorder: cs?.borderColor,
    menuWidth: mr ? Math.round(mr.width) : null,
    menuZ: cs?.zIndex,
    alignRight:
      mr && tr
        ? Math.abs(mr.right - tr.right) < 8
        : null,
    belowTrigger: mr && tr ? mr.top >= tr.bottom - 2 : null,
    items,
    hasCaret: Boolean(caret),
    caretRight: caret ? getComputedStyle(caret).right : null,
    mainTop: document.querySelector('main')?.getBoundingClientRect().top,
  }
})

const shot = resolve(outDir, 'pool-overflow-menu-open-390.png')
await page.screenshot({ path: shot, fullPage: false })

// Outside tap closes
await page.mouse.click(40, 400)
await page.waitForTimeout(300)
const closedAfterOutside = await page.evaluate(
  () => !document.querySelector('[data-slot="dropdown-menu-content"]'),
)

await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(`${baseUrl}/pool/${invite}?tab=predictions`, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(700)
const desktop = await page.evaluate(() => ({
  overflowBtn: Boolean(
    document.querySelector('button[aria-label="Pool options"]'),
  ),
  hasSidebar: document.body.innerText.includes('Invite members'),
}))

await browser.close()

const report = {
  beforeOpen,
  openProbe,
  noLayoutShift:
    beforeOpen.contentShiftY != null &&
    openProbe.mainTop != null &&
    Math.abs(beforeOpen.contentShiftY - openProbe.mainTop) < 1,
  closedAfterOutside,
  desktop,
  shot,
  blueBlockCause:
    'Default DropdownMenuContent used bg-popover token (#111a27) — navy stadium card, reads as a large blue block vs charcoal app surfaces.',
  recipe: {
    surface: '#171717',
    border: '#292929',
    shadow: '0 10px 32px rgba(0,0,0,0.55)',
    width: '11.75rem (~188px)',
    position: 'side=bottom align=end sideOffset=8 (Radix under ⋮, right-aligned)',
    caret: 'absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t #292929 bg #171717',
    hover: 'white/8 — no accent/blue',
    leave: 'text-destructive + icon',
  },
}
writeFileSync(
  resolve(outDir, 'pool-overflow-menu-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
