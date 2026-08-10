import { BrandedStatusPage } from '@/components/branded-status-page'

export default function NotFound() {
  return (
    <BrandedStatusPage
      code="404"
      title="Page not found"
      description="That page doesn’t exist or may have moved. Head back to PoolCup and keep predicting."
      primaryHref="/"
      primaryLabel="Go home"
      secondaryHref="/dashboard"
      secondaryLabel="Dashboard"
    />
  )
}
