import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

const out = resolve('scripts/.screenshots')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

for (const vp of [
  { n: '1280x800', w: 1280, h: 800, expectSize: '106px 162px' },
  { n: '390x844', w: 390, h: 844, expectSize: '91px 139px' },
]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } })
  await page.goto('http://localhost:3000/login', {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('main.login-page-shell'))
    const bg = cs.backgroundImage
    return {
      bgSize: cs.backgroundSize,
      hasUri: bg.includes('data:image/svg+xml;base64,'),
      hasLocked: bg.includes('125deg'),
      stampScaleLocked: bg.includes('0.157143'),
    }
  })
  const shot = resolve(out, `login-footprint-spaced-${vp.n}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  const ok = m.hasUri && m.hasLocked && m.bgSize.startsWith(vp.expectSize)
  console.log(vp.n, ok ? 'PASS' : 'FAIL', JSON.stringify(m), shot)
  await page.close()
  if (!ok) process.exitCode = 1
}

await browser.close()
