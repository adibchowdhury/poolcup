import { Suspense } from 'react'
import { LeaderboardPageView } from '@/components/leaderboard/leaderboard-page-view'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

export const metadata = {
  title: 'Leaderboard | PoolCup',
  description: 'Global and friends XP leaderboards ranked by badge XP.',
}

function LeaderboardFallback() {
  return (
    <main
      className={cn(
        'flex min-h-screen items-center justify-center bg-background',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  )
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardFallback />}>
      <LeaderboardPageView />
    </Suspense>
  )
}
