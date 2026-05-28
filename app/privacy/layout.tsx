import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — PoolCup',
  description:
    'How PoolCup collects, uses, and protects your personal information when you create pools, join, and make predictions.',
  openGraph: {
    title: 'Privacy Policy — PoolCup',
    description:
      'How PoolCup collects, uses, and protects your personal information.',
  },
  alternates: {
    canonical: 'https://www.getpoolcup.com/privacy',
  },
}

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
