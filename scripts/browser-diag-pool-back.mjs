import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function getComputedSummary(el) {
  if (!el) return null
  const style = getComputedStyle(el)
  return {
    tag: el.tagName,
    id: el.id || null,
    className: el.className || null,
    ariaLabel: el.getAttribute('aria-label'),
    role: el.getAttribute('role'),
    pointerEvents: style.pointerEvents,
    zIndex: style.zIndex,
    position: style.position,
    display: style.display,
    visibility: style.visibility,
  }
}

const env = loadEnvLocal()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase env for browser diag')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: pools, error: poolsError } = await admin
  .from('pools')
  .select('id, invite_code, scoring_style, name')
  .neq('scoring_style', 'winner')
  .limit(5)

if (poolsError || !pools?.length) {
  console.error('No classic pools found:', poolsError?.message)
  process.exit(1)
}

const pool = pools[0]
const { data: members, error: membersError } = await admin
  .from('pool_members')
  .select('user_id')
  .eq('pool_id', pool.id)
  .limit(1)

if (membersError || !members?.length) {
  console.error('No pool members:', membersError?.message)
  process.exit(1)
}

const userId = members[0].user_id
const { data: userData, error: userError } =
  await admin.auth.admin.getUserById(userId)

if (userError || !userData?.user?.email) {
  console.error('Could not load member user:', userError?.message)
  process.exit(1)
}

const email = userData.user.email
const { data: linkData, error: linkError } =
  await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${baseUrl}/auth/callback` },
  })

if (linkError || !linkData?.properties?.hashed_token) {
  console.error('generateLink failed:', linkError?.message)
  process.exit(1)
}

const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(`${baseUrl}/auth/callback`)}`

const consoleLogs = []
const consoleErrors = []
const pageErrors = []

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

page.on('console', (msg) => {
  const text = msg.text()
  const entry = { type: msg.type(), text }
  consoleLogs.push(entry)
  if (msg.type() === 'error') consoleErrors.push(text)
})

page.on('pageerror', (err) => {
  pageErrors.push(err.message)
})

await page.goto(verifyUrl, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1500)

const afterAuthUrl = page.url()
const hashParams = Object.fromEntries(
  new URL(afterAuthUrl).hash.replace(/^#/, '').split('&').map((part) => {
    const i = part.indexOf('=')
    return i === -1 ? [part, ''] : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))]
  }),
)

if (hashParams.access_token && hashParams.refresh_token) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  const sessionSet = await page.evaluate(
    async ({ url, key, access_token, refresh_token }) => {
      const { createBrowserClient } = await import(
        'https://cdn.jsdelivr.net/npm/@supabase/ssr@0.6.1/+esm'
      )
      const client = createBrowserClient(url, key)
      const { error } = await client.auth.setSession({
        access_token,
        refresh_token,
      })
      return { error: error?.message ?? null }
    },
    {
      url: supabaseUrl,
      key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      access_token: hashParams.access_token,
      refresh_token: hashParams.refresh_token,
    },
  )
  await page.waitForTimeout(2000)
  if (sessionSet.error) {
    console.error('setSession failed:', sessionSet.error)
  }
}

const poolUrl = `${baseUrl}/pool/${pool.invite_code}?tab=predictions`
await page.goto(poolUrl, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)

const backButton = page.locator('button[aria-label="Back to dashboard"]')
const backCount = await backButton.count()
const onPool = page.url().includes('/pool/')

let hitTarget = null
let buttonComputed = null
let ancestorsAbove = []

let backClickedAfterForce = false
let backClickedProgrammatic = false
let programmaticClickResult = null
if (backCount > 0) {
  const box = await backButton.first().boundingBox()
  if (box) {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const diag = await page.evaluate(({ cx, cy }) => {
      function summary(el) {
        if (!el) return null
        const s = getComputedStyle(el)
        return {
          tag: el.tagName,
          id: el.id || null,
          className: el.className || null,
          ariaLabel: el.getAttribute('aria-label'),
          pointerEvents: s.pointerEvents,
          zIndex: s.zIndex,
          position: s.position,
        }
      }

      const top = document.elementFromPoint(cx, cy)
      const button = document.querySelector(
        'button[aria-label="Back to dashboard"]',
      )
      const chain = []
      let el = top
      while (el) {
        chain.push(summary(el))
        if (el === button) break
        el = el.parentElement
      }

      return {
        center: { cx, cy },
        elementFromPoint: summary(top),
        button: summary(button),
        buttonIsTop: top === button || button?.contains(top),
        chainFromTopToButton: chain,
        nextOverlayCandidates: Array.from(
          document.querySelectorAll('body *'),
        )
          .filter((node) => {
            if (!(node instanceof HTMLElement)) return false
            const s = getComputedStyle(node)
            if (s.pointerEvents === 'none') return false
            if (s.display === 'none' || s.visibility === 'hidden') return false
            const z = Number.parseInt(s.zIndex, 10)
            if (!Number.isFinite(z) || z < 50) return false
            const r = node.getBoundingClientRect()
            return (
              r.width > 0 &&
              r.height > 0 &&
              cx >= r.left &&
              cx <= r.right &&
              cy >= r.top &&
              cy <= r.bottom
            )
          })
          .slice(0, 12)
          .map((node) => summary(node)),
      }
    }, { cx, cy })

    hitTarget = diag.elementFromPoint
    buttonComputed = diag.button
    ancestorsAbove = {
      buttonIsTop: diag.buttonIsTop,
      chain: diag.chainFromTopToButton,
      overlayCandidates: diag.nextOverlayCandidates,
    }
  }

  await backButton.first().click({ timeout: 5000, force: false }).catch((e) => {
    consoleErrors.push(`playwright click: ${e.message}`)
  })
  await page.waitForTimeout(500)

  let backClickedAfterForceLocal = false
  if (!consoleLogs.some((e) => e.text.includes('back clicked'))) {
    await backButton.first().click({ timeout: 5000, force: true }).catch((e) => {
      consoleErrors.push(`playwright force click: ${e.message}`)
    })
    await page.waitForTimeout(1000)
    backClickedAfterForceLocal = consoleLogs.some((e) => e.text.includes('back clicked'))
  }
  backClickedAfterForce = backClickedAfterForceLocal

  const programmaticClick = await page.evaluate(() => {
    const btn = document.querySelector(
      'button[aria-label="Back to dashboard"]',
    )
    if (!(btn instanceof HTMLButtonElement)) return { clicked: false }
    btn.click()
    return { clicked: true }
  })
  programmaticClickResult = programmaticClick
  await page.waitForTimeout(1500)
  backClickedProgrammatic = consoleLogs.some((e) =>
    e.text.includes('back clicked'),
  )

  await page.waitForTimeout(1000)
}

const backClicked = consoleLogs.some((e) => e.text.includes('back clicked'))
const hrefLog = consoleLogs.find((e) => e.text.includes('back clicked'))

const nextIssueBadges = await page
  .locator('text=/Issues|issue/i')
  .allTextContents()
  .catch(() => [])

const nextDevOverlays = await page.evaluate(() => {
  const portal = document.querySelector('nextjs-portal')
  const devScript = document.querySelector('script[data-nextjs-dev-overlay="true"]')
  const issueTexts = []
  if (portal) {
    issueTexts.push(portal.textContent?.trim().replace(/\s+/g, ' ') ?? '')
    for (const node of portal.querySelectorAll('*')) {
      const t = node.textContent?.trim()
      if (t && t.length < 300) issueTexts.push(t.replace(/\s+/g, ' '))
    }
  }
  return {
    portalPresent: !!portal,
    devOverlayScriptPresent: !!devScript,
    portalText: portal?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 2000) ?? null,
    issueTexts: [...new Set(issueTexts)].filter(Boolean).slice(0, 20),
  }
})

const report = {
  pool: { invite: pool.invite_code, name: pool.name, scoring: pool.scoring_style },
  reachedPoolPage: onPool,
  currentUrlBeforeClick: poolUrl,
  urlAfterClick: page.url(),
  backButtonCount: backCount,
  backClicked,
  backClickedAfterForce,
  backClickedProgrammatic,
  programmaticClickResult,
  backClickedLogLine: hrefLog?.text ?? null,
  hitTargetAtButtonCenter: hitTarget,
  backButtonComputed: buttonComputed,
  stacking: ancestorsAbove,
  consoleErrors: [...new Set(consoleErrors)],
  pageErrors: [...new Set(pageErrors)],
  allConsoleWarnings: consoleLogs
    .filter((e) => e.type === 'warning' || e.type === 'error')
    .map((e) => `[${e.type}] ${e.text}`),
  nextIssueBadgeTexts: nextIssueBadges,
  nextDevOverlays,
  posthogDebug: consoleLogs
    .filter((e) => e.text.includes('[ph-debug]'))
    .map((e) => e.text),
}

console.log(JSON.stringify(report, null, 2))
await browser.close()
