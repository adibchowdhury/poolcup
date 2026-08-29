import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

const out = resolve('scripts/.screenshots')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(900)

const metrics = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.login-pucky-panel-form button.ui-tactile-btn')]
  return btns.map((b) => {
    const cs = getComputedStyle(b)
    return {
      text: (b.textContent || '').trim().slice(0, 28),
      hasDrop: b.className.includes('ui-tactile-btn--drop'),
      restShadow: cs.boxShadow,
      restTransform: cs.transform,
      raise: cs.getPropertyValue('--tactile-btn-raise').trim(),
      shadowRestVar: cs.getPropertyValue('--tactile-btn-shadow-rest').trim(),
      shadowHoverVar: cs.getPropertyValue('--tactile-btn-shadow-hover').trim(),
      shadowActiveVar: cs.getPropertyValue('--tactile-btn-shadow-active').trim(),
    }
  })
})

const signIn = page.locator('.login-pucky-panel-form button[type="submit"]')
const box = await signIn.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.waitForTimeout(200)
const pressed = await page.evaluate(() => {
  const b = document.querySelector('.login-pucky-panel-form button[type="submit"]')
  const cs = getComputedStyle(b)
  return { transform: cs.transform, shadow: cs.boxShadow }
})
await page.mouse.up()

const google = page.locator('.login-pucky-panel-form button.ui-tactile-btn--drop').nth(1)
const gbox = await google.boundingBox()
await page.mouse.move(gbox.x + gbox.width / 2, gbox.y + gbox.height / 2)
await page.mouse.down()
await page.waitForTimeout(200)
const googlePressed = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.login-pucky-panel-form button.ui-tactile-btn--drop')][1]
  const cs = getComputedStyle(b)
  return { transform: cs.transform, shadow: cs.boxShadow }
})
await page.mouse.up()
await page.waitForTimeout(150)

const shot = resolve(out, 'login-tactile-drop-1280x800.png')
await page.screenshot({ path: shot, fullPage: false })
console.log(JSON.stringify({ metrics, pressed, googlePressed, shot }, null, 2))
await browser.close()
