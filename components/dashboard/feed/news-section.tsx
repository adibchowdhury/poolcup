'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Newspaper } from 'lucide-react'
import {
  DashboardFeedSection,
} from '@/components/dashboard/feed/dashboard-feed'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_CARD_HOVER_CLASS,
  DASHBOARD_FEED_SURFACE_CLASS_LG,
} from '@/src/lib/dashboard-surfaces'
import type { FootballNewsItem } from '@/src/lib/fetch-football-news'
import { formatRelativeTimestamp } from '@/src/lib/points-transaction-feed'

type NewsApiResponse = {
  items: FootballNewsItem[]
  errors?: string[]
  fetchedAt?: string
}

const DASHBOARD_NEWS_ITEM_LIMIT = 6

function NewsCard({ item }: { item: FootballNewsItem }) {
  const [imageFailed, setImageFailed] = useState(false)
  const relative =
    item.publishedAt != null
      ? formatRelativeTimestamp(item.publishedAt)
      : null
  const showImage = Boolean(item.imageUrl) && !imageFailed

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex min-w-0 flex-col overflow-hidden',
        DASHBOARD_FEED_SURFACE_CLASS_LG,
        DASHBOARD_CARD_HOVER_CLASS,
        'shadow-[0_12px_32px_rgba(0,0,0,0.28)]',
        'hover:-translate-y-0.5 hover:border-primary/35',
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#222222]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- RSS hostnames vary; next/image remote allowlist not practical here
          <img
            src={item.imageUrl!}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#222222]">
            <Newspaper className="h-8 w-8 text-primary/70" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        <p className="line-clamp-3 text-sm font-semibold leading-snug text-foreground sm:text-base">
          {item.title}
        </p>
        <div className="mt-auto flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
          <span className="truncate font-semibold text-primary">
            {item.source}
          </span>
          {relative ? (
            <>
              <span aria-hidden>•</span>
              <span className="shrink-0">{relative}</span>
            </>
          ) : null}
          <ExternalLink
            className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
            aria-hidden
          />
        </div>
      </div>
    </a>
  )
}

function NewsSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4"
      aria-busy="true"
      aria-label="Loading news"
    >
      {Array.from({ length: DASHBOARD_NEWS_ITEM_LIMIT }, (_, index) => (
        <div
          key={index}
          className="min-w-0 overflow-hidden rounded-2xl border border-[#292929]"
        >
          <ShimmerBlock className="aspect-[16/10] w-full rounded-none" />
          <div className="space-y-2 p-3.5">
            <ShimmerBlock className="h-4 w-full rounded" />
            <ShimmerBlock className="h-4 w-4/5 rounded" />
            <ShimmerBlock className="h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Dashboard football news grid — RSS headline teasers with link-out only.
 * No full article text is fetched or displayed.
 */
export function NewsSection({ desktopPanel = false }: { desktopPanel?: boolean } = {}) {
  const [items, setItems] = useState<FootballNewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/news')
      const payload = (await res.json()) as NewsApiResponse

      if (!res.ok) {
        throw new Error(payload.errors?.[0] ?? 'Failed to load news')
      }

      setItems(Array.isArray(payload.items) ? payload.items : [])
      if (
        (!payload.items || payload.items.length === 0) &&
        payload.errors?.length
      ) {
        setError(payload.errors[0] ?? 'No news available right now.')
      }
    } catch (err) {
      setItems([])
      setError(err instanceof Error ? err.message : 'Failed to load news')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!loading && !error && items.length === 0) {
    return null
  }

  return (
    <DashboardFeedSection id="news-highlights" title="News & Highlights" desktopPanel={desktopPanel}>
      {loading ? (
        <NewsSkeleton />
      ) : error && items.length === 0 ? (
        <div className="rounded-2xl border border-[#292929] bg-[#171717] px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void load()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 gap-3 sm:gap-4"
          role="list"
          aria-label="Football news headlines"
        >
          {items.slice(0, DASHBOARD_NEWS_ITEM_LIMIT).map((item) => (
            <div
              key={`${item.source}-${item.url}`}
              className="min-w-0"
              role="listitem"
            >
              <NewsCard item={item} />
            </div>
          ))}
        </div>
      )}
    </DashboardFeedSection>
  )
}
