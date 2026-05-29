import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookie Policy — PoolCup',
  description:
    'How PoolCup uses cookies and similar technologies when you use our prediction pool service.',
  openGraph: {
    title: 'Cookie Policy — PoolCup',
    description: 'How PoolCup uses cookies and similar technologies.',
  },
}

export default function CookiesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
