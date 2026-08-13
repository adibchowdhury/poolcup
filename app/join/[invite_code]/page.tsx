import type { Metadata } from 'next'
import { JoinPoolPageClient } from './join-page-client'
import { fetchPoolOgData } from '@/src/lib/og/pool-og-data'
import { siteUrl } from '@/src/lib/site'

type PageProps = {
  params: Promise<{ invite_code: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { invite_code: inviteCode } = await params
  const pool = await fetchPoolOgData(inviteCode)

  if (!pool) {
    return {
      title: 'Join pool · PoolCup',
      description: 'Join a prediction pool on PoolCup.',
    }
  }

  const title = `Join ${pool.name} on PoolCup`
  const description = [
    pool.eventName ? `${pool.eventName}` : 'Prediction pool',
    pool.memberCount === 1
      ? '1 member so far'
      : `${pool.memberCount} members so far`,
    'Make your predictions and climb the leaderboard.',
  ].join(' · ')

  const ogImage = `${siteUrl}/join/${encodeURIComponent(inviteCode)}/opengraph-image`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${siteUrl}/join/${encodeURIComponent(inviteCode)}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: pool.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default function JoinPoolPage() {
  return <JoinPoolPageClient />
}
