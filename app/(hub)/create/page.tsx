'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CreatePoolWizard } from '@/components/create/create-pool-wizard'
import {
  isCreatePoolDesktopModalViewport,
  setCreatePoolModalHandoff,
} from '@/src/lib/create-pool-modal-handoff'

/**
 * Desktop: bounce to dashboard and open the hub create modal (Stripe returns
 * and deep links included). Mobile: full-screen wizard page.
 */
function CreatePoolDesktopBounce() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isCreatePoolDesktopModalViewport()) return

    const checkoutRaw = searchParams.get('checkout')
    const checkout =
      checkoutRaw === 'success' || checkoutRaw === 'cancel'
        ? checkoutRaw
        : null
    const draftId = searchParams.get('draft_id')
    const eventSlug = searchParams.get('event')

    setCreatePoolModalHandoff({
      checkout,
      draftId,
      eventSlug,
    })
    router.replace('/dashboard')
  }, [router, searchParams])

                              return null
}

function CreatePoolMobilePage() {
                    return (
              <div className="lg:hidden">
      <CreatePoolWizard variant="page" />
                </div>
  )
}

export default function CreatePoolPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-background">
          <p className="text-[#5a7080]">Loading…</p>
        </main>
      }
    >
      <CreatePoolDesktopBounce />
      <CreatePoolMobilePage />
    </Suspense>
  )
}
