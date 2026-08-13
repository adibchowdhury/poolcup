import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — PoolCup',
  description:
    'Play free. Upgrade to Pool Commissioner ($9.99/mo) for scoring, branding, announcements, and admin tools. PoolCup Pro coming soon.',
  openGraph: {
    title: 'Pricing — PoolCup',
    description:
      'Play free. Upgrade to Commissioner when you run the pool. Pro coming soon.',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
