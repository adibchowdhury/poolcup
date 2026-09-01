import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const path = '/college-football-pick-em'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const res = await fetch(`${baseUrl}${path}`, {
  headers: { Accept: 'text/html' },
})
const html = await res.text()

function extractJsonLd(doc) {
  const blocks = [
    ...doc.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
  return blocks.map((m) => {
    try {
      return JSON.parse(m[1])
    } catch {
      return { parseError: true, raw: m[1]?.slice(0, 200) }
    }
  })
}

const jsonLdBlocks = extractJsonLd(html)
const faqLd = jsonLdBlocks.find((b) => b?.['@type'] === 'FAQPage')
const entities = Array.isArray(faqLd?.mainEntity) ? faqLd.mainEntity : []

const faqChecks = entities.map((entity) => {
  const q = entity?.name ?? ''
  const a = entity?.acceptedAnswer?.text ?? ''
  return {
    question: q,
    answerPreview: a.slice(0, 80),
    questionInHtml: q ? html.includes(q) : false,
    answerInHtml: a ? html.includes(a) : false,
    shapeOk:
      entity?.['@type'] === 'Question' &&
      entity?.acceptedAnswer?.['@type'] === 'Answer' &&
      typeof q === 'string' &&
      typeof a === 'string' &&
      q.length > 0 &&
      a.length > 0,
  }
})

const titleMatch = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null
const canonical =
  html.match(/rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)?.[1] ??
  html.match(/href=["']([^"']*)["'][^>]*rel=["']canonical["']/i)?.[1] ??
  null
const ogTitle =
  html.match(/property=["']og:title["'][^>]*content=["']([^"']*)["']/i)?.[1] ??
  html.match(/content=["']([^"']*)["'][^>]*property=["']og:title["']/i)?.[1] ??
  null
const ogDesc =
  html.match(
    /property=["']og:description["'][^>]*content=["']([^"']*)["']/i,
  )?.[1] ??
  html.match(
    /content=["']([^"']*)["'][^>]*property=["']og:description["']/i,
  )?.[1] ??
  null
const robotsMeta =
  html.match(/name=["']robots["'][^>]*content=["']([^"']*)["']/i)?.[1] ??
  html.match(/content=["']([^"']*)["'][^>]*name=["']robots["']/i)?.[1] ??
  null

const contentChecks = {
  heroH1: /College Football Pick/i.test(html),
  whatIs: html.includes('What is College Football Pick'),
  slateHeading:
    html.includes("This Week's College Football Games") ||
    html.includes('This Week&#x27;s College Football Games'),
  howItWorks: html.includes('How College Football Pick'),
  whyPoolcup: html.includes('Why Run Your College Football Pick'),
  faqHeading: /College Football Pick.?em FAQ/i.test(html),
  launchingCta: html.includes('Launching This Week'),
  nflSecondaryCta: html.includes('Play NFL Pick'),
  morePickEm: html.includes('More pick'),
  launchingSection: html.includes('id="launching"'),
  createPoolFaq: html.includes('When can I create a college football pool'),
  noindex: /noindex/i.test(html),
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${baseUrl}${path}`, {
  waitUntil: 'networkidle',
  timeout: 60000,
})

const headingTree = await page.evaluate(() => {
  return [...document.querySelectorAll('h1, h2, h3')].map((el) => ({
    tag: el.tagName.toLowerCase(),
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
  }))
})

const shot390 = resolve(outDir, 'college-football-pick-em-390.png')
await page.screenshot({ path: shot390, fullPage: true })

await page.setViewportSize({ width: 1440, height: 900 })
await page.waitForTimeout(400)
const shot1440 = resolve(outDir, 'college-football-pick-em-1440.png')
await page.screenshot({ path: shot1440, fullPage: true })

let lighthouse = null
try {
  const lhJson = execSync(
    `npx lighthouse ${baseUrl}${path} --only-categories=performance,accessibility,best-practices,seo --form-factor=mobile --chrome-flags="--headless" --output=json --quiet`,
    { encoding: 'utf8', timeout: 180000 },
  )
  const lh = JSON.parse(lhJson)
  lighthouse = {
    performance: Math.round((lh.categories?.performance?.score ?? 0) * 100),
    accessibility: Math.round((lh.categories?.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((lh.categories?.['best-practices']?.score ?? 0) * 100),
    seo: Math.round((lh.categories?.seo?.score ?? 0) * 100),
  }
} catch (err) {
  lighthouse = { error: String(err?.message ?? err) }
}

await browser.close()

const report = {
  status: res.status,
  meta: { titleMatch, canonical, ogTitle, ogDesc, robotsMeta },
  contentChecks,
  faq: {
    entityCount: entities.length,
    expectedCount: 6,
    allShapeOk: faqChecks.every((r) => r.shapeOk),
    allTextInHtml: faqChecks.every((r) => r.questionInHtml && r.answerInHtml),
    checks: faqChecks,
  },
  jsonLdWellFormed: Boolean(faqLd) && !faqLd.parseError,
  headingTree,
  lighthouse,
  shots: { shot390, shot1440 },
}

writeFileSync(
  resolve(outDir, 'college-football-pick-em-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
