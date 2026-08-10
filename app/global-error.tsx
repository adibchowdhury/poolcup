'use client'

import { useEffect } from 'react'
import { BrandedStatusPage } from '@/components/branded-status-page'
import './globals.css'

/**
 * Root fatal error UI (replaces root layout when it fails).
 * Must provide its own html/body; keep deps minimal.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error boundary:', error)
  }, [error])

  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased bg-background text-foreground">
        <BrandedStatusPage
          title="Something went wrong"
          description="PoolCup ran into a serious error. Try again, or go home and continue from there."
          onPrimaryAction={reset}
          primaryActionLabel="Try again"
          primaryHref="/"
          primaryLabel="Go home"
        />
      </body>
    </html>
  )
}
