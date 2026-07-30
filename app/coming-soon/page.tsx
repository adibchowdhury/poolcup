import type { Metadata } from 'next'
import { ComingSoonContent } from '@/app/coming-soon/coming-soon-content'

export const metadata: Metadata = {
  title: 'PoolCup — Coming Soon',
  description:
    'PoolCup is rebuilding for more sports, more events, and year-round competition. Launching August 24, 2026.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ComingSoonPage() {
  return <ComingSoonContent />
}
