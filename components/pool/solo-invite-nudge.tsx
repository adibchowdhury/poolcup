'use client'

import { useEffect, useRef } from 'react'
import { Users } from 'lucide-react'
import { PoolInviteCard } from '@/components/pool/pool-invite-card'
import { capturePostHog } from '@/src/lib/posthog-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { cn } from '@/lib/utils'

type SoloInviteNudgeProps = {
  inviteCode: string
  poolId: string
  poolName: string
  memberCount: number
  acceptingMembers: boolean
}

/** Shown when a pool is near-empty (creator-only / 1–2 members). */
export function SoloInviteNudge({
  inviteCode,
  poolId,
  poolName,
  memberCount,
  acceptingMembers,
}: SoloInviteNudgeProps) {
  const shownRef = useRef(false)

  useEffect(() => {
    if (!acceptingMembers || memberCount > 2 || shownRef.current) return
    shownRef.current = true
    capturePostHog('invite_nudge_shown', {
      pool_id: poolId,
      member_count: memberCount,
    })
  }, [acceptingMembers, memberCount, poolId])

  if (!acceptingMembers || memberCount > 2) return null

  return (
    <section
      className={cn(
        'rounded-2xl border border-primary/35 bg-primary/10 px-4 py-4 sm:px-5',
        FOCUS_VISIBLE_RING,
      )}
      aria-label="Invite friends to this pool"
    >
      <div className="mb-3 flex items-start gap-3">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div>
          <h3 className="font-display text-xl tracking-wide text-foreground">
            This pool&apos;s quiet — invite friends
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pools are more fun with competition. Share your invite so friends
            can join {poolName}.
          </p>
        </div>
      </div>
      <div
        onClick={() =>
          capturePostHog('invite_nudge_clicked', { pool_id: poolId })
        }
      >
        <PoolInviteCard
          inviteCode={inviteCode}
          poolId={poolId}
          poolName={poolName}
          source="solo_nudge"
        />
      </div>
    </section>
  )
}
