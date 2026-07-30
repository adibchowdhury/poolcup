import Parser from 'rss-parser'

/** Cache TTL for football RSS aggregation (30 minutes). */
export const FOOTBALL_NEWS_REVALIDATE_SECONDS = 30 * 60

/** Max items returned to the dashboard. */
export const FOOTBALL_NEWS_ITEM_LIMIT = 18

/** Feeds whose clocks run ahead shouldn't jump the queue. */
const FUTURE_SKEW_TOLERANCE_MS = 60 * 60 * 1000

export type FootballNewsItem = {
  title: string
  url: string
  source: string
  publishedAt: string | null
  imageUrl: string | null
}

type FeedConfig = {
  source: string
  url: string
}

/**
 * Reputable football RSS feeds — headline + link syndication only.
 * Verified image paths per feed:
 * - BBC Sport:    item > media:thumbnail  -> $.url (single, 240px)
 * - The Guardian: item > media:content    -> $.url (widths 140/460/700)
 * - ESPN:         no media/enclosure/img  -> imageUrl stays null (card fallback)
 */
const FOOTBALL_RSS_FEEDS: FeedConfig[] = [
  {
    source: 'BBC Sport',
    url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
  },
  {
    source: 'The Guardian',
    url: 'https://www.theguardian.com/football/rss',
  },
  {
    source: 'ESPN',
    url: 'https://www.espn.com/espn/rss/soccer/news',
  },
]

type RawItem = {
  title?: string
  link?: string
  pubDate?: string
  isoDate?: string
  content?: string
  contentSnippet?: string
  description?: string
  enclosure?: { url?: string; type?: string }
  enclosureRaw?: unknown
  mediaThumbnail?: unknown
  mediaContent?: unknown
}

/**
 * media:* fields are namespaced, so rss-parser only surfaces them when declared
 * here. Their URL lives in an XML attribute (`$.url`), not the text node.
 */
const parser = new Parser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['media:content', 'mediaContent', { keepArray: true }],
      ['enclosure', 'enclosureRaw', { keepArray: true }],
    ],
  },
})

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function pickUrlAttr(value: unknown): string | null {
  if (typeof value === 'string' && value.startsWith('http')) return value
  const record = asRecord(value)
  if (!record) return null

  if (typeof record.url === 'string' && record.url.startsWith('http')) {
    return record.url
  }

  const attrs = asRecord(record.$)
  if (attrs && typeof attrs.url === 'string' && attrs.url.startsWith('http')) {
    return attrs.url
  }

  return null
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function readAttr(value: unknown, attr: string): string | null {
  const record = asRecord(value)
  if (!record) return null
  const attrs = asRecord(record.$) ?? record
  const raw = attrs[attr]
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw)
  return null
}

/** Widest image at or below this width; card thumbnails are ~264px wide. */
const MAX_THUMBNAIL_WIDTH = 700

function pickWidestUrl(candidates: unknown[]): string | null {
  let best: string | null = null
  let bestWidth = -1

  for (const candidate of candidates) {
    const url = pickUrlAttr(candidate)
    if (!url) continue

    const type = readAttr(candidate, 'type') ?? readAttr(candidate, 'medium')
    if (type && !/^image/i.test(type)) continue

    const width = Number(readAttr(candidate, 'width') ?? Number.NaN)
    if (!Number.isFinite(width) || width <= 0) {
      if (!best) best = url
      continue
    }
    if (width <= MAX_THUMBNAIL_WIDTH && width > bestWidth) {
      best = url
      bestWidth = width
    } else if (!best) {
      best = url
    }
  }

  return best
}

const IMG_SRC_PATTERN = /<img[^>]+src=["']([^"']+)["']/i

function extractImageUrl(item: RawItem): string | null {
  const fromThumbnail = pickWidestUrl(toArray(item.mediaThumbnail))
  if (fromThumbnail) return fromThumbnail

  const fromContent = pickWidestUrl(toArray(item.mediaContent))
  if (fromContent) return fromContent

  const enclosures = toArray(item.enclosureRaw)
  if (item.enclosure) enclosures.push(item.enclosure)
  const fromEnclosure = pickWidestUrl(enclosures)
  if (fromEnclosure) return fromEnclosure

  for (const html of [item.content, item.description, item.contentSnippet]) {
    if (typeof html !== 'string') continue
    const src = html.match(IMG_SRC_PATTERN)?.[1]
    if (src?.startsWith('http')) return src
  }

  return null
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

function toIsoPublishedAt(item: RawItem): string | null {
  if (item.isoDate) {
    const ms = new Date(item.isoDate).getTime()
    if (Number.isFinite(ms)) return new Date(ms).toISOString()
  }
  if (item.pubDate) {
    const ms = new Date(item.pubDate).getTime()
    if (Number.isFinite(ms)) return new Date(ms).toISOString()
  }
  return null
}

async function fetchFeedItems(
  feed: FeedConfig,
): Promise<{ items: FootballNewsItem[]; error: string | null }> {
  try {
    const res = await fetch(feed.url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': 'PoolCupNews/1.0 (+https://poolcup.app)',
      },
      next: { revalidate: FOOTBALL_NEWS_REVALIDATE_SECONDS },
    })

    if (!res.ok) {
      return {
        items: [],
        error: `${feed.source} HTTP ${res.status}`,
      }
    }

    const xml = await res.text()
    const parsed = await parser.parseString(xml)
    const items: FootballNewsItem[] = []

    for (const raw of (parsed.items ?? []) as RawItem[]) {
      const title = raw.title?.trim()
      const url = raw.link?.trim()
      if (!title || !url || !url.startsWith('http')) continue

      items.push({
        title,
        url,
        source: feed.source,
        publishedAt: toIsoPublishedAt(raw),
        imageUrl: extractImageUrl(raw),
      })
    }

    return { items, error: null }
  } catch (err) {
    return {
      items: [],
      error:
        err instanceof Error
          ? `${feed.source}: ${err.message}`
          : `${feed.source}: failed`,
    }
  }
}

/**
 * Fetch, parse, merge, sort, and dedupe football RSS items.
 * Per-feed failures are skipped; successful feeds still return.
 */
export async function fetchFootballNews(): Promise<{
  items: FootballNewsItem[]
  errors: string[]
  fetchedAt: string
}> {
  const results = await Promise.all(
    FOOTBALL_RSS_FEEDS.map((feed) => fetchFeedItems(feed)),
  )

  const errors = results
    .map((row) => row.error)
    .filter((msg): msg is string => Boolean(msg))

  const merged = results.flatMap((row) => row.items)

  const ceiling = Date.now() + FUTURE_SKEW_TOLERANCE_MS
  const sortKey = (item: FootballNewsItem) => {
    const ms = item.publishedAt ? new Date(item.publishedAt).getTime() : 0
    if (!Number.isFinite(ms)) return 0
    return Math.min(ms, ceiling)
  }

  const sorted = [...merged].sort((a, b) => sortKey(b) - sortKey(a))

  const seenUrls = new Set<string>()
  const seenTitles = new Set<string>()

  // Per-source queues, each newest-first, preserving the merged sort order.
  const queues = new Map<string, FootballNewsItem[]>()
  for (const item of sorted) {
    const urlKey = item.url.split('#')[0]!.toLowerCase()
    const titleKey = normalizeTitle(item.title)
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue
    seenUrls.add(urlKey)
    seenTitles.add(titleKey)
    const queue = queues.get(item.source)
    if (queue) queue.push(item)
    else queues.set(item.source, [item])
  }

  // Round-robin across feeds instead of a pure date sort: ESPN stamps pubDate
  // hours ahead of BBC/Guardian and ships no images, so a global sort filled the
  // whole strip with imageless ESPN cards.
  const lanes = [...queues.values()]
  const deduped: FootballNewsItem[] = []
  for (let depth = 0; deduped.length < FOOTBALL_NEWS_ITEM_LIMIT; depth += 1) {
    let advanced = false
    for (const lane of lanes) {
      const item = lane[depth]
      if (!item) continue
      advanced = true
      deduped.push(item)
      if (deduped.length >= FOOTBALL_NEWS_ITEM_LIMIT) break
    }
    if (!advanced) break
  }

  return {
    items: deduped,
    errors,
    fetchedAt: new Date().toISOString(),
  }
}
