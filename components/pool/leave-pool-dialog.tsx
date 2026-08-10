'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'
import { TransferOwnershipDialog } from '@/components/pool/transfer-ownership-dialog'
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
import { leavePool } from '@/src/lib/leave-pool'
import { supabase } from '@/src/lib/supabase'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'

type LeavePoolDialogProps = {
  poolId: string
  poolName: string
  currentUserId: string
  isCreator: boolean
  members: LeaderboardMember[]
  /** Optional: sync parent creator id after transfer-before-leave (rare). */
  onOwnershipTransferred?: (newOwnerUserId: string) => void
  triggerClassName?: string
}

export function LeavePoolDialog({
  poolId,
  poolName,
  currentUserId,
  isCreator,
  members,
  onOwnershipTransferred,
  triggerClassName,
}: LeavePoolDialogProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [onlyMemberOpen, setOnlyMemberOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetLeaveState() {
    setSubmitting(false)
    setError(null)
  }

  async function attemptLeave() {
    setSubmitting(true)
    setError(null)

    const result = await leavePool(supabase, poolId)

    if (result.ok) {
      toast.success('You left the pool')
      setConfirmOpen(false)
      setTransferOpen(false)
      resetLeaveState()
      router.push('/dashboard')
      router.refresh()
      return
    }

    setSubmitting(false)

    if (result.code === 'creator_must_transfer') {
      setConfirmOpen(false)
      setTransferOpen(true)
      return
    }

    if (result.code === 'creator_only_member') {
      setConfirmOpen(false)
      setOnlyMemberOpen(true)
      return
    }

    setError(result.message)
  }

  async function leaveAfterTransfer(newOwnerUserId: string) {
    onOwnershipTransferred?.(newOwnerUserId)
    const result = await leavePool(supabase, poolId)

    if (result.ok) {
      toast.success('Ownership transferred — you left the pool')
      setTransferOpen(false)
      resetLeaveState()
      router.push('/dashboard')
      router.refresh()
      return
    }

    setError(result.message)
    toast.error(result.message)
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-border bg-card/70 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive',
          FOCUS_RING,
          triggerClassName,
        )}
        onClick={() => {
          setError(null)
          setConfirmOpen(true)
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Leave pool
      </button>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (submitting) return
          setConfirmOpen(next)
          if (!next) resetLeaveState()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave “{poolName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {isCreator
                ? 'As host, you may need to transfer ownership to another member before leaving. Your predictions in this pool will be removed.'
                : 'You will lose access to this pool and your predictions here will be removed. You can rejoin later with an invite if the pool is open.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className={FOCUS_RING}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              className={FOCUS_RING}
              onClick={() => void attemptLeave()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Leaving…
                </>
              ) : (
                'Leave pool'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TransferOwnershipDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        poolId={poolId}
        poolName={poolName}
        currentUserId={currentUserId}
        members={members}
        leaveAfterTransfer
        onTransferredThenLeave={leaveAfterTransfer}
      />

      <AlertDialog
        open={onlyMemberOpen}
        onOpenChange={setOnlyMemberOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the pool instead</AlertDialogTitle>
            <AlertDialogDescription>
              You are the only member of “{poolName}”. Leave isn’t available —
              delete the pool if you no longer need it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <DeletePoolDialog
              poolId={poolId}
              poolName={poolName}
              redirectTo="/dashboard"
              triggerVariant="danger"
              triggerClassName={cn(FOCUS_RING)}
              stopPropagation={false}
            />
            <Button
              type="button"
              variant="outline"
              className={FOCUS_RING}
              onClick={() => setOnlyMemberOpen(false)}
            >
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
