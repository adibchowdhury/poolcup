import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { AnalyticsDashboardPage } from '@/components/analytics/analytics-dashboard-page'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Analytics | PoolCup',
  description:
    'Pro analytics for current form, AI insights, and historical season performance.',
  robots: { index: false, follow: false },
}

function AnalyticsFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <ShimmerBlock className="mb-2 h-4 w-28 rounded-md" />
      <ShimmerBlock className="mb-6 h-10 w-64 rounded-md" />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <ShimmerBlock className="h-56 w-full rounded-xl" />
    </div>
  )
}

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/analytics')
  }

  return (
    <main
      className={cn(
        'min-h-screen bg-background text-foreground',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <Suspense fallback={<AnalyticsFallback />}>
        <AnalyticsDashboardPage />
      </Suspense>
    </main>
  )
}
