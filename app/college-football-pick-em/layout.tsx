import type { Metadata } from 'next'

// Update CFB_PICK_EM_SEASON_YEAR annually — year in title supports CTR.
import { CFB_PICK_EM_SEASON_YEAR } from '@/src/lib/college-football-pick-em-season'

const TITLE = `College Football Pick'em ${CFB_PICK_EM_SEASON_YEAR} – Free CFB Pick'em Pool | PoolCup`
const DESCRIPTION = `Run a free college football pick'em pool for ${CFB_PICK_EM_SEASON_YEAR}. Pick Saturday winners, invite friends, and climb a live leaderboard — PoolCup scores it automatically.`

/**
 * Marketing SEO for /college-football-pick-em.
 * Explicit canonical — do not rely on root x-pathname fallback alone.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/college-football-pick-em',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: '/college-football-pick-em',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function CollegeFootballPickEmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
