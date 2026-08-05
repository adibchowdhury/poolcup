import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — PoolCup',
  description:
    'Free forever. Upgrade to PoolCup Pro ($4.99/mo) or Pool Commissioner ($9.99/mo) when you want more.',
  openGraph: {
    title: 'Pricing — PoolCup',
    description:
      'Free forever. Upgrade to Pro or Commissioner when you want more.',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
