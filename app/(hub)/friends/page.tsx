import { redirect } from 'next/navigation'
import { FriendsPageView } from '@/components/friends/friends-page-view'
import { getHubAuth } from '@/src/lib/hub-session'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Social | PoolCup',
  description:
    'See what your friends are doing on PoolCup, compare on the friends leaderboard, and manage friends.',
}

export default async function FriendsPage() {
  const { user } = await getHubAuth()

  if (!user) {
    redirect('/login?next=/friends')
  }

  return (
    <FriendsPageView
      userId={user.id}
      email={user.email ?? ''}
    />
  )
}
