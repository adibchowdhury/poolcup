import type { Metadata } from 'next'
import { PoolPageClient } from './pool-page-client'
import { fetchPoolOgData } from '@/src/lib/og/pool-og-data'
import { siteUrl } from '@/src/lib/site'

type PageProps = {
  params: Promise<{ invite_code: string }>
  searchParams: Promise<{ tab?: string | string[]; section?: string | string[] }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { invite_code: inviteCode } = await params
  const pool = await fetchPoolOgData(inviteCode)

  if (!pool) {
    return {
      title: 'Pool not found · PoolCup',
      description: 'This prediction pool could not be found on PoolCup.',
    }
  }

  const title = `${pool.name} · Join on PoolCup`
  const description = [
    pool.eventName ? `${pool.eventName} prediction pool` : 'Prediction pool',
    pool.memberCount === 1
      ? '1 member'
      : `${pool.memberCount} members`,
    'Join my pool on PoolCup',
  ].join(' · ')

  const ogImage = `${siteUrl}/pool/${encodeURIComponent(inviteCode)}/opengraph-image`

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

export default async function PoolPage() {
  return <PoolPageClient />
}
