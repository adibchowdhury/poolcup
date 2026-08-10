'use client'

import { useMemo, useState } from 'react'
import { Crown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { transferPoolOwnership } from '@/src/lib/leave-pool'
import { supabase } from '@/src/lib/supabase'
import { UserAvatarImage } from '@/components/user-avatar-image'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'

type TransferOwnershipDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  poolId: string
  poolName: string
  currentUserId: string
  members: LeaderboardMember[]
  /** Called after a successful transfer with the new owner’s user id. */
  onTransferred?: (newOwnerUserId: string) => void
  /**
   * When true, primary action transfers then leaves the pool (leave flow).
   * Parent handles leave after transfer via `onTransferredThenLeave`.
   */
  leaveAfterTransfer?: boolean
  onTransferredThenLeave?: (newOwnerUserId: string) => void | Promise<void>
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  poolId,
  poolName,
  currentUserId,
  members,
  onTransferred,
  leaveAfterTransfer = false,
  onTransferredThenLeave,
}: TransferOwnershipDialogProps) {
  const candidates = useMemo(
    () =>
      [...members]
        .filter((m) => m.userId && m.userId !== currentUserId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members, currentUserId],
  )

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setSelectedUserId(null)
    setSubmitting(false)
    setError(null)
  }

  async function handleConfirm() {
    if (!selectedUserId || submitting) return

    setSubmitting(true)
    setError(null)

    const { error: transferError } = await transferPoolOwnership(
      supabase,
      poolId,
      selectedUserId,
    )

    if (transferError) {
      setError(transferError)
      setSubmitting(false)
      return
    }

    const newOwner = selectedUserId
    if (leaveAfterTransfer && onTransferredThenLeave) {
      await onTransferredThenLeave(newOwner)
      setSubmitting(false)
      return
    }

    toast.success('Ownership transferred')
    onTransferred?.(newOwner)
    reset()
    onOpenChange(false)
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {leaveAfterTransfer
              ? 'Transfer ownership to leave'
              : `Transfer ownership of “${poolName}”?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {leaveAfterTransfer
              ? 'Pick a member to become the new host. After transfer you will leave the pool.'
              : 'The new host can manage members, scoring, and invites. You stay in the pool as a regular member.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No other members to transfer to. Invite someone first, or delete the
            pool if you are the only member.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto" role="listbox">
            {candidates.map((member) => {
              const selected = selectedUserId === member.userId
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={submitting}
                    onClick={() => setSelectedUserId(member.userId)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      FOCUS_RING,
                      'rounded-xl',
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card/70 hover:border-primary/40',
                    )}
                  >
                    <UserAvatarImage
                      avatar={member.avatar}
                      customAvatarUrl={member.customAvatarUrl}
                      className="h-10 w-10"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {member.name}
                    </span>
                    {selected ? (
                      <Crown
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={submitting}
            className={FOCUS_RING}
          >
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={!selectedUserId || submitting || candidates.length === 0}
            onClick={() => void handleConfirm()}
            className={cn(FOCUS_RING)}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {leaveAfterTransfer ? 'Transferring…' : 'Transferring…'}
              </>
            ) : leaveAfterTransfer ? (
              'Transfer & leave'
            ) : (
              'Transfer ownership'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
