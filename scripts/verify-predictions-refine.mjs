import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { mkdirSync } from 'fs'
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

async function probe(page) {
  return page.evaluate(() => {
    const title = [...document.querySelectorAll('h3')].find((el) =>
      /your predictions/i.test(el.textContent || ''),
    )
    const stageList = document.querySelector(
      '[aria-label="Tournament round"], [aria-label="Season or playoffs"]',
    )
    const filterList = document.querySelector(
      '[aria-label="Filter predictions by status"]',
    )
    const groupHeaders = [...document.querySelectorAll('button[aria-expanded]')]
      .filter((b) => /Collapse|Expand/i.test(b.getAttribute('aria-label') || ''))
      .map((b) => ({
        label: (b.querySelector('h2')?.textContent || '').trim(),
        expanded: b.getAttribute('aria-expanded') === 'true',
        hasMatchCount: /\d+\s+matches?/i.test(b.textContent || ''),
      }))

    const saveBtn = [...document.querySelectorAll('button')].find((b) =>
      /Save predictions|Saved|Saving|All done|Try again/i.test(
        (b.textContent || '').trim(),
      ),
    )
    const saveFixed = saveBtn?.closest('div.fixed')
    const saveOpacity = saveFixed
      ? parseFloat(getComputedStyle(saveFixed).opacity)
      : null
    const saveHidden =
      saveFixed == null ||
      getComputedStyle(saveFixed).pointerEvents === 'none' ||
      parseFloat(getComputedStyle(saveFixed).opacity) < 0.2

    const pills = [...document.querySelectorAll('span')].filter((el) =>
      /· \+\d+ pts$/.test((el.textContent || '').trim()),
    )
    const pillSample = pills.slice(0, 4).map((el) => {
      const cs = getComputedStyle(el)
      return {
        text: (el.textContent || '').trim(),
        whiteSpace: cs.whiteSpace,
        fontSize: cs.fontSize,
        padding: `${cs.paddingTop} ${cs.paddingRight}`,
      }
    })

    const grid = document.querySelector('.pool-predictions-desktop-grid')
    const gridCs = grid ? getComputedStyle(grid) : null
    const firstCardInner = grid?.querySelector('article > div')
    const cardCs = firstCardInner ? getComputedStyle(firstCardInner) : null
    const editableInputs = document.querySelectorAll(
      'input[inputmode="numeric"]:not([disabled]):not([readonly])',
    ).length

    return {
      hierarchyTops: {
        title: title?.getBoundingClientRect().top ?? null,
        stage: stageList?.getBoundingClientRect().top ?? null,
        filter: filterList?.getBoundingClientRect().top ?? null,
        firstGroup: groupHeaders[0]
          ? (
              [...document.querySelectorAll('button[aria-expanded]')].find(
                (b) =>
                  /Collapse|Expand/i.test(b.getAttribute('aria-label') || ''),
              )?.getBoundingClientRect().top ?? null
            )
          : null,
      },
      groupHeaders,
      saveOpacity,
      saveHidden,
      editableInputs,
      pillSample,
      grid: gridCs
        ? {
            columns: gridCs.gridTemplateColumns,
            columnGap: gridCs.columnGap,
            rowGap: gridCs.rowGap,
            colCount: gridCs.gridTemplateColumns.trim().split(/\s+/).length,
          }
        : null,
      card: cardCs
        ? {
            bg: cardCs.backgroundColor,
            border: cardCs.borderTopColor,
            shadow: cardCs.boxShadow.split(',').pop()?.trim(),
          }
        : null,
    }
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const cookies = await authAs(creatorId)

  for (const { name, size } of [
    { name: '1280', size: { width: 1280, height: 800 } },
    { name: '1440', size: { width: 1440, height: 900 } },
  ]) {
    const context = await browser.newContext({ viewport: size })
    await context.addCookies(cookies)
    const page = await context.newPage()
    await page.goto(`${baseUrl}/pool/afcaad5c?tab=predictions`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await page.waitForTimeout(2500)

    const before = await probe(page)
    await page.screenshot({
      path: resolve(outDir, `predictions-refine-${name}-clean.png`),
      fullPage: false,
    })

    // Find an editable match: try Predicted, then round tabs with upcoming fixtures
    const tryDirty = async () => {
      for (const nameRe of [/Predicted/i, /Unpicked/i, /All/i]) {
        const tab = page.getByRole('tab', { name: nameRe })
        if ((await tab.count()) > 0) {
          await tab.first().click()
          await page.waitForTimeout(500)
        }
        const input = page
          .locator('input[inputmode="numeric"]:not([disabled])')
          .first()
        if ((await input.count()) > 0) {
          await input.click({ force: true })
          await input.fill('2')
          await page.waitForTimeout(600)
          return true
        }
      }
      // Walk tournament round tabs
      const roundTabs = page.locator(
        '[aria-label="Tournament round"] [role="tab"]',
      )
      const n = await roundTabs.count()
      for (let i = 0; i < n; i++) {
        await roundTabs.nth(i).click()
        await page.waitForTimeout(500)
        const allTab = page.getByRole('tab', { name: /^All\b/i })
        if ((await allTab.count()) > 0) await allTab.first().click()
        await page.waitForTimeout(300)
        const input = page
          .locator('input[inputmode="numeric"]:not([disabled])')
          .first()
        if ((await input.count()) > 0) {
          await input.click({ force: true })
          await input.fill('2')
          await page.waitForTimeout(600)
          return true
        }
      }
      return false
    }

    const dirtyOk = await tryDirty()

    const dirty = await probe(page)
    await page.screenshot({
      path: resolve(outDir, `predictions-refine-${name}-dirty.png`),
      fullPage: false,
    })

    console.log(
      JSON.stringify(
        {
          viewport: name,
          before,
          dirtyAttempted: dirtyOk,
          dirty: {
            saveOpacity: dirty.saveOpacity,
            saveHidden: dirty.saveHidden,
            editableInputs: dirty.editableInputs,
            groups: dirty.groupHeaders,
            hierarchy: dirty.hierarchyTops,
          },
        },
        null,
        2,
      ),
    )
    await context.close()
  }

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
