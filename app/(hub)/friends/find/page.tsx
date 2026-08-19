import { redirect } from 'next/navigation'
import { FriendsFindPageView } from '@/components/friends/friends-find-page-view'
import { getHubAuth } from '@/src/lib/hub-session'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Find friends | PoolCup',
  description: 'Search PoolCup players by username or name and send friend requests.',
}

export default async function FriendsFindPage() {
  const { user } = await getHubAuth()

  if (!user) {
    redirect('/login?next=/friends/find')
  }

  return (
    <FriendsFindPageView
      userId={user.id}
      email={user.email ?? ''}
    />
  )
}
