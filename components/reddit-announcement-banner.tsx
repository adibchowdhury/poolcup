'use client'

/** World Cup 2026 final — banner shows through this date (UTC), then stops automatically. */
const BANNER_LAST_ACTIVE_DAY_UTC = Date.UTC(2026, 6, 19)

const REDDIT_SUBREDDIT_URL = 'https://www.reddit.com/r/PoolCup'

export function isRedditAnnouncementBannerActive(now = new Date()): boolean {
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )
  return todayUtc <= BANNER_LAST_ACTIVE_DAY_UTC
}

export function RedditAnnouncementBanner() {
  if (!isRedditAnnouncementBannerActive()) {
    return null
  }

  return (
    <div className="border-b border-primary/25 bg-[#0a1410] px-4 py-2.5 text-center">
      <a
        href={REDDIT_SUBREDDIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline text-xs leading-snug text-[#d1dde6] underline-offset-2 transition-colors hover:text-[#f0f4f8] hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
      >
        Join <span className="font-semibold text-primary">r/PoolCup</span> for app
        updates, bug fixes, feature requests, and World Cup prediction
        discussions.
      </a>
    </div>
  )
}
