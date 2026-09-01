import { chromium } from 'playwright'
import dotenv from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const res = await fetch(`${baseUrl}/nfl-pick-em`, {
  headers: { Accept: 'text/html' },
})
const html = await res.text()

const checks = {
  status: res.status,
  hasH1: /<h1[^>]*>[\s\S]*?NFL Pick/i.test(html),
  hasWhatIsH2: /What is NFL Pick/i.test(html),
  hasHowH2: /How NFL Pick[\s\S]*?Works on PoolCup/i.test(html),
  hasWhyH2: /Why Run Your Pick[\s\S]*?Pool on PoolCup/i.test(html),
  hasCreateStep: /Create your pool/i.test(html),
  hasInviteStep: /Invite your crew/i.test(html),
  hasWeeklyPicks: /Make weekly picks/i.test(html),
  hasClimb: /Climb the leaderboard/i.test(html),
  hasNoSpreadsheets: /No spreadsheets/i.test(html),
  hasHomepageLink: /href=["']\/["'][^>]*>[\s\S]*?PoolCup homepage/i.test(html) ||
    html.includes('PoolCup homepage'),
  hasPricingLink: html.includes('href="/pricing"') && html.includes('PoolCup pricing'),
  hasLoginCreate: html.includes('/login?next=/create'),
  // stubs still present as empty landmarks
  hasMatchupsStub: /aria-label="Upcoming NFL matchups"/i.test(html),
  hasFaqStub: /aria-label="NFL Pick'em FAQ"/i.test(html),
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await page.goto(`${baseUrl}/nfl-pick-em`, { waitUntil: 'networkidle', timeout: 60000 })
const shot390 = resolve(outDir, 'nfl-pick-em-phase2-390.png')
await page.screenshot({ path: shot390, fullPage: true })

await page.setViewportSize({ width: 1440, height: 900 })
await page.waitForTimeout(400)
const shot1440 = resolve(outDir, 'nfl-pick-em-phase2-1440.png')
await page.screenshot({ path: shot1440, fullPage: true })
await browser.close()

const report = { checks, shots: { shot390, shot1440 } }
writeFileSync(resolve(outDir, 'nfl-pick-em-phase2-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (checks.status !== 200 || !checks.hasH1 || !checks.hasWhatIsH2 || !checks.hasHowH2 || !checks.hasWhyH2) {
  process.exitCode = 1
}
