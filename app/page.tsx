import { RedditAnnouncementBanner } from '@/components/reddit-announcement-banner'
import LandingPage from '@/components/pages/landing-page'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'PoolCup',
  url: 'https://www.getpoolcup.com',
  description:
    'Create private World Cup prediction pools with friends, family, or coworkers. Everyone predicts match scores, earns points automatically, and competes on a live leaderboard.',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '15',
    priceCurrency: 'USD',
  },
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RedditAnnouncementBanner />
      <LandingPage />
    </>
  )
}