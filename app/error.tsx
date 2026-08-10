'use client'

import { useEffect } from 'react'
import { BrandedStatusPage } from '@/components/branded-status-page'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Route error boundary:', error)
  }, [error])

  return (
    <BrandedStatusPage
      title="Something went wrong"
      description="We hit an unexpected error loading this page. Try again, or head home and pick up where you left off."
      onPrimaryAction={reset}
      primaryActionLabel="Try again"
      primaryHref="/"
      primaryLabel="Go home"
      secondaryHref="/dashboard"
      secondaryLabel="Dashboard"
    />
  )
}
