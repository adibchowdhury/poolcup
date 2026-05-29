import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — PoolCup',
  description: 'The terms governing your use of PoolCup prediction pools and related services.',
  openGraph: {
    title: 'Terms of Service — PoolCup',
    description: 'The terms governing your use of PoolCup.',
  },
}

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
