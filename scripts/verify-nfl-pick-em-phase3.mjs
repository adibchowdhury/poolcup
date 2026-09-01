import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

function formatNflKickoffEt(iso) {
  const date = new Date(iso)
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
  return `${datePart} · ${timePart} ET`
}

const res = await fetch(`${baseUrl}/nfl-pick-em`, {
  headers: { Accept: 'text/html' },
})
const html = await res.text()

const teamChecks = [
  'Seattle Seahawks',
  'New England Patriots',
  'Kansas City Chiefs',
  'Denver Broncos',
]
const teamsInHtml = Object.fromEntries(
  teamChecks.map((t) => [t, html.includes(t)]),
)

const hasHeading = html.includes("This Week's NFL Games") || html.includes('This Week&#x27;s NFL Games')
const hasQuietCta = html.includes('Get your pool ready before kickoff')
const hasDegrade = html.includes('schedule is loading')
const kickoffSample = formatNflKickoffEt('2026-09-10T00:20:00+00:00')
const etInHtml = /ET</.test(html) || html.includes(' ET')
const timeSampleInHtml = html.includes(kickoffSample) || /Sep 9 · 8:20 PM ET/.test(html)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await page.goto(`${baseUrl}/nfl-pick-em`, { waitUntil: 'networkidle', timeout: 60000 })
// Scroll to matchups
await page.getByRole('heading', { name: /This Week/i }).scrollIntoViewIfNeeded()
const shot390 = resolve(outDir, 'nfl-pick-em-phase3-390.png')
await page.screenshot({ path: shot390, fullPage: false })

await page.setViewportSize({ width: 1440, height: 900 })
await page.waitForTimeout(400)
await page.getByRole('heading', { name: /This Week/i }).scrollIntoViewIfNeeded()
const shot1440 = resolve(outDir, 'nfl-pick-em-phase3-1440.png')
await page.screenshot({ path: shot1440, fullPage: false })

const rowCount = await page.locator('#nfl-pick-em-matchups-heading ~ * li, [aria-labelledby="nfl-pick-em-matchups-heading"] li').count()
await browser.close()

const report = {
  status: res.status,
  curl: {
    teamsInHtml,
    allTeamsPresent: Object.values(teamsInHtml).every(Boolean),
    hasHeading,
    hasQuietCta,
    hasDegradeEmpty: hasDegrade,
    etInHtml,
    kickoffSampleFormatted: kickoffSample,
    timeSampleInHtml,
  },
  rowCount,
  shots: { shot390, shot1440 },
}

writeFileSync(resolve(outDir, 'nfl-pick-em-phase3-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
