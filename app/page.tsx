import LandingPage from '@/components/pages/landing-page'
import { supabase } from '@/src/lib/supabase'

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

export default async function Home() {
  const { data, error } = await supabase.from('matches').select('*').limit(1)
  console.log('SUPABASE TEST — data:', data, 'error:', error)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  )
}