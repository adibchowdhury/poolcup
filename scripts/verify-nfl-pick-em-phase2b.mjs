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

const EXPECTED_CREATE = '/create?event=nfl-2026'
const EXPECTED_LOGIN_HREF = `/login?next=${encodeURIComponent(EXPECTED_CREATE)}`

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
  return {
    email: user.email,
    cookies: [
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
    ],
  }
}

/** Read wizard selection from CreateCompetitionStep UI. */
async function readWizardSelection(page, { root = null } = {}) {
  const scope = root ?? page
  await scope.locator('[aria-label="Sports"]').waitFor({ timeout: 30000 })
  await scope
    .locator('.create-competition-step__list, .create-competition-step__empty')
    .first()
    .waitFor({ timeout: 30000 })
  // Allow swap animation / soft load
  await page.waitForTimeout(800)

  return scope.evaluate(() => {
    const sportsNav = document.querySelector('[aria-label="Sports"]')
    const selectedTab =
      sportsNav?.querySelector('[aria-selected="true"]') ??
      sportsNav?.querySelector('[aria-pressed="true"]')
    const selectedSport = (selectedTab?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()

    const competitionHeading =
      document
        .querySelector('#create-competition-panel [id^="create-sport-"], .create-competition-step__panel-title, [aria-labelledby^="create-sport-"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim() ??
      (
        document.querySelector('.create-competition-step__list')?.previousElementSibling ||
        document.querySelector('[id^="create-sport-"].create-competition-step__sport[aria-selected="true"]')
      )?.textContent?.replace(/\s+/g, ' ').trim() ??
      null

    // Heading text like "Competitions · Football"
    const panelLabel =
      [...document.querySelectorAll('p, h2, h3, span')]
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /^Competitions/i.test(t)) ?? null

    const pressedRows = [
      ...document.querySelectorAll(
        '.create-competition-step__row[aria-pressed="true"]',
      ),
    ].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())

    const allRows = [
      ...document.querySelectorAll('.create-competition-step__row'),
    ].map((el) => ({
      pressed: el.getAttribute('aria-pressed') === 'true',
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    }))

    const nflPressed = pressedRows.some((t) => /NFL/i.test(t))
    const bodyHas = (re) => re.test(document.body?.innerText || '')

    return {
      selectedSport,
      panelLabel,
      competitionHeading,
      pressedRows,
      nflPressed,
      nflRows: allRows.filter((r) => /NFL/i.test(r.text)),
      stillOnStep1:
        bodyHas(/Competitions|What are you predicting/) &&
        !bodyHas(/Choose a plan|Review your pool/i),
      loading: bodyHas(/Loading competitions/),
    }
  })
}

const browser = await chromium.launch({ headless: true })
const report = {
  expectedLoginHref: EXPECTED_LOGIN_HREF,
  expectedCreateHref: EXPECTED_CREATE,
}

{
  const raw = EXPECTED_LOGIN_HREF.split('?')[1]
  const sp = new URLSearchParams(raw)
  const next = sp.get('next')
  report.loginNextDecode = {
    rawNextParam: next,
    decoded: next ? decodeURIComponent(next) : null,
    matchesCreate: decodeURIComponent(next || '') === EXPECTED_CREATE,
  }
}

// --- Logged-out funnel @390 ---
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const page = await ctx.newPage()
  await page.goto(`${baseUrl}/nfl-pick-em`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  const primaryHref = await page
    .getByRole('link', { name: /Create Your NFL Pick/i })
    .first()
    .getAttribute('href')
  report.loggedOut = {
    primaryHref,
    hrefMatches: primaryHref === EXPECTED_LOGIN_HREF,
  }

  await page.getByRole('link', { name: /Create Your NFL Pick/i }).first().click()
  await page.waitForURL(/\/login/, { timeout: 15000 })
  const loginUrl = new URL(page.url())
  const nextFromLogin = loginUrl.searchParams.get('next')
  report.loggedOut.loginUrl = page.url()
  report.loggedOut.nextOnLogin = nextFromLogin
  report.loggedOut.nextPreserved = nextFromLogin === EXPECTED_CREATE

  // Sign in as test account (service-role magiclink session — same as prior verify scripts),
  // then honor next exactly as login does: router.push(next).
  const auth = await authAs(creatorId)
  await ctx.addCookies(auth.cookies)
  report.loggedOut.testAccountEmail = auth.email
  await page.goto(`${baseUrl}${nextFromLogin}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForTimeout(1500)
  report.loggedOut.afterAuthUrl = page.url()
  report.loggedOut.wizard = await readWizardSelection(page)
  report.loggedOut.preselectedOk =
    report.loggedOut.wizard.selectedSport === 'Football' &&
    report.loggedOut.wizard.nflPressed
  const shot = resolve(outDir, 'nfl-pick-em-phase2b-logged-out-funnel-390.png')
  await page.screenshot({ path: shot, fullPage: false })
  report.loggedOut.shot = shot
  await ctx.close()
}

// --- Logged-in: CTA → wizard preselected directly ---
{
  const auth = await authAs(creatorId)
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  await ctx.addCookies(auth.cookies)
  const page = await ctx.newPage()
  await page.goto(`${baseUrl}/nfl-pick-em`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForTimeout(1200)
  const primaryHref = await page
    .getByRole('link', { name: /Create Your NFL Pick/i })
    .first()
    .getAttribute('href')
  report.loggedIn = {
    primaryHref,
    hrefMatchesCreate: primaryHref === EXPECTED_CREATE,
  }
  await page.getByRole('link', { name: /Create Your NFL Pick/i }).first().click()
  await page.waitForURL(/\/create/, { timeout: 15000 })
  await page.waitForTimeout(1500)
  report.loggedIn.afterClickUrl = page.url()
  report.loggedIn.wizard = await readWizardSelection(page)
  report.loggedIn.preselectedOk =
    report.loggedIn.wizard.selectedSport === 'Football' &&
    report.loggedIn.wizard.nflPressed
  const shot = resolve(outDir, 'nfl-pick-em-phase2b-logged-in-funnel-390.png')
  await page.screenshot({ path: shot, fullPage: false })
  report.loggedIn.shot = shot
  await ctx.close()
}

// --- Desktop spot-check (logged-in → modal handoff) ---
{
  const auth = await authAs(creatorId)
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  await ctx.addCookies(auth.cookies)
  const page = await ctx.newPage()
  await page.goto(`${baseUrl}/nfl-pick-em`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForTimeout(1200)
  await page.getByRole('link', { name: /Create Your NFL Pick/i }).first().click()
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {})
  const dialog = page.getByRole('dialog', { name: /Create a pool/i })
  await dialog.waitFor({ state: 'visible', timeout: 15000 })
  report.desktop = {
    afterClickUrl: page.url(),
    modalVisible: true,
  }
  report.desktop.wizard = await readWizardSelection(page, { root: dialog })
  report.desktop.preselectedOk =
    report.desktop.wizard.selectedSport === 'Football' &&
    report.desktop.wizard.nflPressed
  const shot = resolve(outDir, 'nfl-pick-em-phase2b-desktop-1440.png')
  await page.screenshot({ path: shot, fullPage: false })
  report.desktop.shot = shot
  await ctx.close()
}

// --- Plain /create (no param) vs with event ---
{
  const auth = await authAs(creatorId)
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  await ctx.addCookies(auth.cookies)
  const page = await ctx.newPage()

  await page.goto(`${baseUrl}/create`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForTimeout(1500)
  const plain = await readWizardSelection(page)
  const plainShot = resolve(outDir, 'nfl-pick-em-phase2b-plain-create-390.png')
  await page.screenshot({ path: plainShot, fullPage: false })

  await page.goto(`${baseUrl}${EXPECTED_CREATE}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForTimeout(1500)
  const withEvent = await readWizardSelection(page)

  report.plainCreate = {
    plain,
    withEvent,
    plainShot,
    plainHasNoForcedNflEvent: !plain.nflPressed,
    eventForcesFootballAndNfl:
      withEvent.selectedSport === 'Football' && withEvent.nflPressed,
  }
  await ctx.close()
}

await browser.close()

const out = resolve(outDir, 'nfl-pick-em-phase2b-report.json')
writeFileSync(out, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
