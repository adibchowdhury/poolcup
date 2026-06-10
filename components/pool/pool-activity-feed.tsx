'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { PoolActivityRow } from '@/components/pool/pool-activity-row'
import { PoolInviteCard } from '@/components/pool/pool-invite-card'
import {
  fetchPoolActivityFeed,
  type PoolActivityFeedItem,
} from '@/src/lib/pool-activity-feed'

type PoolActivityFeedProps = {
  poolId: string
  inviteCode: string
  currentUserId: string
}

export function PoolActivityFeed({
  poolId,
  inviteCode,
  currentUserId,
}: PoolActivityFeedProps) {
  const [items, setItems] = useState<PoolActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { items: rows, error: fetchError } = await fetchPoolActivityFeed(poolId)
    if (fetchError) {
      setError(fetchError)
      setItems([])
    } else {
      setItems(rows)
    }
    setLoading(false)
  }, [poolId])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">Loading feed…</p>
    )
  }

  if (error) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Could not load activity right now.
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <Users className="mx-auto mb-4 h-10 w-10 text-primary/80" />
        <h2 className="font-display text-xl tracking-wide text-foreground">
          Invite friends and watch their picks roll in
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Share your pool link. When someone joins and saves predictions, you&apos;ll
          see it here.
        </p>
        <PoolInviteCard
          inviteCode={inviteCode}
          poolId={poolId}
          className="mx-auto mt-6 max-w-lg"
        />
      </div>
    )
  }

  return (
    <ul className="w-full min-w-0 max-w-full space-y-2">
      {items.map((activity) => (
        <li key={activity.id}>
          <PoolActivityRow activity={activity} currentUserId={currentUserId} />
        </li>
      ))}
    </ul>
  )
}
