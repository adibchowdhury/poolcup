import type { Metadata } from 'next'

const TITLE = "NFL Pick'em 2026 – Free NFL Pick'em Pool | PoolCup"
const DESCRIPTION =
  "Create a free NFL Pick'em pool for the 2026 season. Invite friends, pick every game, and climb a live leaderboard — PoolCup keeps score automatically."

/**
 * Marketing SEO for /nfl-pick-em.
 * Explicit canonical — do not rely on root x-pathname fallback alone.
 *
 * OG images: marketing layouts (pricing, contact, legal) set title/description
 * only — no shared opengraph-image route. Join/pool use dynamic OG images;
 * this page matches the marketing pattern (metadataBase supplies absolute URLs).
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/nfl-pick-em',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: '/nfl-pick-em',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
  // Ensure we never inherit a noindex from a parent (none set today).
  robots: {
    index: true,
    follow: true,
  },
}

export default function NflPickEmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
