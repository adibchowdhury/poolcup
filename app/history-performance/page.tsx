import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Historical Performance | PoolCup',
  description: 'Pro season and year performance history across PoolCup.',
  robots: { index: false, follow: false },
}

/** Canonical URL is /analytics?tab=history (merged Analytics page). */
export default function HistoryPerformanceRedirect() {
  redirect('/analytics?tab=history')
}
