import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — PoolCup',
  description:
    'PoolCup is completely free — no subscriptions, no fees. User-supported World Cup prediction pools.',
  openGraph: {
    title: 'Pricing — PoolCup',
    description: 'PoolCup is completely free. No subscriptions, no fees.',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
