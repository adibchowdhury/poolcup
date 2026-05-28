import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Support — PoolCup',
  description:
    'Questions about PoolCup prediction pools? Reach out to our team for help with your account, pools, or billing.',
  openGraph: {
    title: 'Contact Support — PoolCup',
    description: 'Questions about PoolCup? We would love to hear from you.',
  },
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
