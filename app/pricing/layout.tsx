import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — PoolCup',
  description:
    'Free for players. Upgrade any pool to Custom Pool for $9.99 one-time — logo, colors, custom scoring, announcements, and commissioner tools. No subscription.',
  openGraph: {
    title: 'Pricing — PoolCup',
    description:
      'Play free. Custom Pool is $9.99 one-time per pool. No subscription. Members always play free.',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
