/**
 * Measure mobile login card vertical rhythm + logo size at 390.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const label = process.argv[2] ?? 'probe'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(500)

  const data = await page.evaluate(() => {
    const q = (sel) => document.querySelector(sel)
    const card = q('.login-pucky-card')
    const logo = q('.login-mobile-logo img')
    const h1 = card?.querySelector('h1')
    const sub = h1?.nextElementSibling
    const form = card?.querySelector('form')
    const email = q('#email')
    const password = q('#password')
    const forgot = [...(card?.querySelectorAll('button') ?? [])].find((b) =>
      (b.textContent || '').includes('Forgot'),
    )
    const signIn = [...(card?.querySelectorAll('button[type="submit"]') ?? [])].find((b) =>
      (b.textContent || '').toLowerCase().includes('sign'),
    )
    const frame = [...document.querySelectorAll('.login-pucky-frame')].find(
      (el) => getComputedStyle(el).display !== 'none',
    )

    const r = (el) => (el ? el.getBoundingClientRect() : null)
    const cr = r(card)
    const lr = r(logo)
    const hr = r(h1)
    const sr = r(sub)
    const er = r(email)
    const pr = r(password)
    const fr = r(forgot)
    const sir = r(signIn)
    const pkr = r(frame)
    const stage = q('.login-pucky-stage')
    const stageR = r(stage)
    const formCs = form ? getComputedStyle(form) : null
    const logoWrap = q('.login-mobile-logo')
    const panel = q('.login-pucky-panel-form')

    const gap = (a, b) => (a && b ? +(b.top - a.bottom).toFixed(1) : null)

    const unitTop = Math.min(pkr?.top ?? Infinity, cr?.top ?? Infinity)
    const unitBottom = Math.max(pkr?.bottom ?? 0, cr?.bottom ?? 0)
    const gapAbove = unitTop
    const gapBelow = window.innerHeight - unitBottom

    return {
      cardH: cr ? +cr.height.toFixed(1) : null,
      stageH: stageR ? +stageR.height.toFixed(1) : null,
      panelPad: panel ? getComputedStyle(panel).padding : null,
      logo: lr ? { w: +lr.width.toFixed(1), h: +lr.height.toFixed(1) } : null,
      logoMb: logoWrap ? getComputedStyle(logoWrap).marginBottom : null,
      gaps: {
        logoToH1: gap(lr, hr),
        h1ToSub: gap(hr, sr),
        subToEmail: gap(sr, er),
        emailToPassword: gap(er, pr),
        passwordToForgot: gap(pr, fr),
        forgotToSignIn: gap(fr, sir),
        passwordToSignIn: gap(pr, sir),
      },
      formSpaceY: formCs?.rowGap || formCs?.gap || null,
      formMt: form ? getComputedStyle(form).marginTop : null,
      signInMt: signIn ? getComputedStyle(signIn).marginTop : null,
      signInMb: signIn ? getComputedStyle(signIn).marginBottom : null,
      forgotWrapMt: forgot?.parentElement
        ? getComputedStyle(forgot.parentElement).marginTop
        : null,
      overhangPx: pkr && cr ? +(cr.top - pkr.top).toFixed(1) : null,
      handLine: pkr && cr ? +(pkr.top + pkr.height * 0.7578).toFixed(1) : null,
      cardTop: cr ? +cr.top.toFixed(1) : null,
      gapAbove: +gapAbove.toFixed(1),
      gapBelow: +gapBelow.toFixed(1),
      aboveSharePct:
        gapAbove + gapBelow > 0
          ? +((100 * gapAbove) / (gapAbove + gapBelow)).toFixed(1)
          : null,
      belowSharePct:
        gapAbove + gapBelow > 0
          ? +((100 * gapBelow) / (gapAbove + gapBelow)).toFixed(1)
          : null,
    }
  })

  const shot = resolve(outDir, `login-mobile-polish-${label}-390x844.png`)
  await page.screenshot({ path: shot, fullPage: false })
  writeFileSync(
    resolve(outDir, `login-mobile-polish-${label}-report.json`),
    JSON.stringify({ ...data, shot }, null, 2),
  )
  console.log(JSON.stringify({ ...data, shot }, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
