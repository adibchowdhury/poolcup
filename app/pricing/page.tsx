import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { SiteFooter } from '@/components/site-footer'
import { SupportUsButton } from '@/components/support-us-button'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link
            href="/"
            className="group rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
          </Link>
          <PoolCupLogo />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <div className="text-center">
          <h1 className="font-display text-4xl tracking-wide text-foreground md:text-5xl">
            Pricing
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
            PoolCup is completely free — no subscriptions and no fees. Create pools,
            invite your friends, and make predictions without paying a cent.
          </p>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
            We&apos;re user-supported. If PoolCup helps your group have fun during
            the World Cup, consider chipping in.
          </p>
          <div className="mt-8 flex justify-center">
            <SupportUsButton className="px-5 py-2.5 text-sm font-semibold" />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
