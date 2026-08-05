import { LandingPricingSection } from '@/components/landing/landing-pricing-section'
import { PublicPageShell } from '@/components/public-page-shell'

export default function PricingPage() {
  return (
    <PublicPageShell
      pageBackgroundClass="bg-[#0a0e12]"
      footerBackgroundClass="bg-[#0a0e12]"
    >
      <LandingPricingSection />
    </PublicPageShell>
  )
}
