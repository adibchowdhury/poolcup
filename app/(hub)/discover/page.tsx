import { redirect } from 'next/navigation'
import { DiscoverPageView } from '@/components/discover/discover-page-view'
import { getHubAuth } from '@/src/lib/hub-session'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Discover | PoolCup',
  description:
    'Browse official, public, and trending PoolCup pools by sport. Join a pool and start predicting.',
}

export default async function DiscoverPage() {
  const { user } = await getHubAuth()

  if (!user) {
    redirect('/login?next=/discover')
  }

  return (
    <DiscoverPageView
      userId={user.id}
      email={user.email ?? ''}
    />
  )
}
