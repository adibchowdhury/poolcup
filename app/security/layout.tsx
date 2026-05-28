import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security — PoolCup',
  description:
    'Learn how PoolCup protects your account, pools, and predictions with modern security practices.',
  openGraph: {
    title: 'Security — PoolCup',
    description:
      'Learn how PoolCup protects your data with modern security practices.',
  },
  alternates: {
    canonical: 'https://www.getpoolcup.com/security',
  },
}

export default function SecurityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
