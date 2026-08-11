import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { DiscoverPageView } from '@/components/discover/discover-page-view'
import { cn } from '@/lib/utils'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'

export const metadata = {
  title: 'Discover | PoolCup',
  description:
    'Browse official PoolCup pools by sport and competition. Join trending pools and see upcoming events.',
}

function DiscoverFallback() {
  return (
    <main
      className={cn(
        'flex min-h-screen items-center justify-center bg-app-background',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  )
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<DiscoverFallback />}>
      <DiscoverPageView />
    </Suspense>
  )
}
