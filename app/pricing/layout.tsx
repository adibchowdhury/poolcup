import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — PoolCup',
  description:
    'Play free. Upgrade to PoolCup Pro ($4.99/mo) for insights and themes, or Pool Commissioner ($9.99/mo) for scoring, branding, announcements, and admin tools.',
  openGraph: {
    title: 'Pricing — PoolCup',
    description:
      'Play free. Upgrade to Pro for insights, or Commissioner when you run the pool.',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
