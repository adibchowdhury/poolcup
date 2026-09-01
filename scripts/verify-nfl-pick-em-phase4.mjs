import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
const outDir = resolve(process.cwd(), 'scripts/.screenshots')
mkdirSync(outDir, { recursive: true })

const res = await fetch(`${baseUrl}/nfl-pick-em`, {
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

const contentChecks = {
  heroH1: /NFL Pick/i.test(html),
  whatIs: html.includes('What is NFL Pick'),
  slateHeading:
    html.includes("This Week's NFL Games") ||
    html.includes('This Week&#x27;s NFL Games'),
  seahawks: html.includes('Seattle Seahawks'),
  howItWorks: html.includes('How NFL Pick'),
  whyPoolcup: html.includes('Why Run Your Pick'),
  faqHeading: /NFL Pick.?em FAQ/i.test(html),
  quietCta: html.includes('Get your pool ready before kickoff'),
  bottomCta: html.includes('Ready to start your NFL pick'),
  lockAnswer: html.includes('Picks lock at each game'),
  midSeasonAnswer: html.includes('as long as the pool is still accepting members'),
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${baseUrl}/nfl-pick-em`, {
  waitUntil: 'networkidle',
  timeout: 60000,
})

const headingTree = await page.evaluate(() => {
  return [...document.querySelectorAll('h1, h2, h3')].map((el) => ({
    tag: el.tagName.toLowerCase(),
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
  }))
})

const shot390 = resolve(outDir, 'nfl-pick-em-phase4-390.png')
await page.screenshot({ path: shot390, fullPage: true })

await page.setViewportSize({ width: 1440, height: 900 })
await page.waitForTimeout(400)
const shot1440 = resolve(outDir, 'nfl-pick-em-phase4-1440.png')
await page.screenshot({ path: shot1440, fullPage: true })

await browser.close()

const report = {
  status: res.status,
  meta: { titleMatch, canonical, ogTitle, ogDesc },
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
  shots: { shot390, shot1440 },
}

writeFileSync(
  resolve(outDir, 'nfl-pick-em-phase4-report.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
