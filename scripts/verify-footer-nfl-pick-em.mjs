import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3001'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 60000 })

const desktopLink = page
  .locator('footer')
  .getByRole('link', { name: "NFL Pick'em", exact: true })
await desktopLink.scrollIntoViewIfNeeded()
const href = await desktopLink.getAttribute('href')

const footer = page.locator('footer')
const box = await footer.boundingBox()
const shot1440 = resolve(outDir, 'footer-nfl-pick-em-1440.png')
if (box) {
  await page.screenshot({
    path: shot1440,
    clip: {
      x: 0,
      y: Math.max(0, box.y - 16),
      width: 1440,
      height: Math.min(box.height + 32, 1200),
    },
  })
} else {
  await page.screenshot({ path: shot1440, fullPage: false })
}

await desktopLink.click()
await page.waitForURL(/\/nfl-pick-em/, { timeout: 15000 })
const afterDesktopNav = page.url()

await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 60000 })
await page.setViewportSize({ width: 390, height: 844 })
const accordion = page.locator('footer').getByRole('button', { name: /Site Map/i })
if (await accordion.count()) {
  await accordion.click()
}
const mobileLink = page
  .locator('footer')
  .getByRole('link', { name: "NFL Pick'em", exact: true })
await mobileLink.waitFor({ timeout: 10000 })
await mobileLink.scrollIntoViewIfNeeded()
const mHref = await mobileLink.getAttribute('href')

const mBox = await page.locator('footer').boundingBox()
const shot390 = resolve(outDir, 'footer-nfl-pick-em-390.png')
if (mBox) {
  await page.screenshot({
    path: shot390,
    clip: {
      x: 0,
      y: Math.max(0, mBox.y - 8),
      width: 390,
      height: Math.min(mBox.height + 16, 900),
    },
  })
} else {
  await page.screenshot({ path: shot390, fullPage: false })
}

await mobileLink.click()
await page.waitForURL(/\/nfl-pick-em/, { timeout: 15000 })
const afterMobileNav = page.url()

await browser.close()

const report = {
  href,
  mHref,
  afterDesktopNav,
  afterMobileNav,
  shots: { shot1440, shot390 },
}
writeFileSync(resolve(outDir, 'footer-nfl-pick-em-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
