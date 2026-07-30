import { NextResponse } from 'next/server'
import { fetchFootballNews } from '@/src/lib/fetch-football-news'

/**
 * Aggregated football news from public RSS feeds.
 * Returns headline teasers only (title, source, optional thumbnail, outbound URL).
 * Does not store or return full article bodies.
 *
 * Cache: 30 minutes (route segment + Cache-Control).
 */
export const revalidate = 1800

export async function GET() {
  try {
    const payload = await fetchFootballNews()

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control':
          'public, s-maxage=1800, stale-while-revalidate=1800',
      },
    })
  } catch (err) {
    return NextResponse.json(
      {
        items: [],
        errors: [
          err instanceof Error ? err.message : 'Failed to load football news',
        ],
        fetchedAt: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
