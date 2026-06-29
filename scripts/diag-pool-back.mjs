import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const poolPath = process.env.POOL_PATH ?? '/pool/test'

const consoleLogs = []
const consoleErrors = []

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

page.on('console', (msg) => {
  const text = msg.text()
  if (msg.type() === 'error') consoleErrors.push(text)
  else consoleLogs.push(`[${msg.type()}] ${text}`)
})

await page.goto(`${baseUrl}${poolPath}`, { waitUntil: 'networkidle', timeout: 30000 })

const backButton = page.locator('button[aria-label="Back to dashboard"]')
const backCount = await backButton.count()
const url = page.url()
const title = await page.title()

let elementAtBackPoint = null
if (backCount > 0) {
  const box = await backButton.first().boundingBox()
  if (box) {
    elementAtBackPoint = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x + 4, y + 4)
      if (!el) return null
      return {
        tag: el.tagName,
        className: el.className,
        ariaLabel: el.getAttribute('aria-label'),
        id: el.id,
        pointerEvents: getComputedStyle(el).pointerEvents,
        zIndex: getComputedStyle(el).zIndex,
      }
    }, { x: box.x, y: box.y })
  }

  await backButton.first().click({ timeout: 5000 }).catch((e) => {
    consoleErrors.push(`click failed: ${e.message}`)
  })
  await page.waitForTimeout(1500)
}

const afterUrl = page.url()
const backClicked = consoleLogs.some((l) => l.includes('back clicked'))

console.log(JSON.stringify({
  initialUrl: url,
  afterClickUrl: afterUrl,
  title,
  backButtonCount: backCount,
  elementAtBackPoint,
  backClicked,
  consoleErrors,
  relevantLogs: consoleLogs.filter((l) => l.includes('back clicked') || l.includes('Issue') || l.includes('Hydration') || l.includes('error')),
}, null, 2))

await browser.close()
