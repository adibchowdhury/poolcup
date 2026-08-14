import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { PredictionHistoryPage } from '@/components/history/prediction-history-page'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'
import { MOBILE_BOTTOM_NAV_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Prediction History | PoolCup',
  description: 'Browse your full prediction history across PoolCup.',
  robots: { index: false, follow: false },
}

function HistoryFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <ShimmerBlock className="mb-2 h-4 w-24 rounded-md" />
      <ShimmerBlock className="mb-6 h-10 w-48 rounded-md" />
      <ShimmerBlock className="mb-5 h-40 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default async function HistoryPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/history')
  }

  return (
    <main
      className={cn(
        'min-h-screen bg-background text-foreground',
        MOBILE_BOTTOM_NAV_PAD_CLASS,
      )}
    >
      <Suspense fallback={<HistoryFallback />}>
        <PredictionHistoryPage />
      </Suspense>
    </main>
  )
}
