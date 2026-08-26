'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  DashboardGlassBackdrops,
  dashboardGlassSurfaceClass,
} from '@/components/dashboard/dashboard-glass-surface'
import { beginCreatePoolEntry } from '@/src/lib/create-pool-transition'
import { useCreatePoolModalOptional } from '@/components/create/create-pool-modal'

function normalizeInviteCode(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  const joinMatch = trimmed.match(/\/join\/([^/?#]+)/i)
  if (joinMatch?.[1]) return decodeURIComponent(joinMatch[1]).trim()

  const poolMatch = trimmed.match(/\/pool\/([^/?#]+)/i)
  if (poolMatch?.[1]) return decodeURIComponent(poolMatch[1]).trim()

  return trimmed
}

type DialogStep = 'choose' | 'join'

export function JoinOrCreatePoolCard() {
  const router = useRouter()
  const createModal = useCreatePoolModalOptional()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<DialogStep>('choose')
  const [inviteCode, setInviteCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  function resetDialog() {
    setStep('choose')
    setInviteCode('')
    setJoinError(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetDialog()
  }

  function handleCreate() {
    setOpen(false)
    resetDialog()
    beginCreatePoolEntry(router, {
      openModal: createModal
        ? () => createModal.openCreatePoolModal()
        : undefined,
    })
  }

  function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = normalizeInviteCode(inviteCode)
    if (!code) {
      setJoinError('Enter an invite code to continue.')
      return
    }
    setOpen(false)
    resetDialog()
    router.push(`/join/${encodeURIComponent(code)}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          dashboardGlassSurfaceClass('2xl'),
          'group w-full cursor-pointer border-2 border-dashed border-white/25 text-left transition-colors hover:border-primary/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        )}
      >
        <DashboardGlassBackdrops variant="full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-[#ffb300]/5 opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="relative flex min-h-[280px] flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted transition-transform group-hover:scale-110">
            <Plus className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>
          <h3 className="mb-2 font-display text-xl text-foreground">
            Join or Create a Pool
          </h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Start competing with friends or join an existing pool with an invite
            code
          </p>
        </div>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {step === 'choose' ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl tracking-wide">
                  Join or create a pool
                </DialogTitle>
                <DialogDescription>
                  Create a new pool for your group, or join one with an invite
                  code from a friend.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 pt-2">
                <Button
                  type="button"
                  className="h-auto justify-start gap-3 bg-primary px-4 py-4 text-left text-primary-foreground hover:bg-primary/90"
                  onClick={handleCreate}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">Create a pool</span>
                    <span className="block text-xs font-normal opacity-90">
                      Set up scoring and invite your friends
                    </span>
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-3 px-4 py-4 text-left"
                  onClick={() => {
                    setJoinError(null)
                    setStep('join')
                  }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Users className="h-5 w-5 text-primary" />
                  </span>
                  <span>
                    <span className="block font-semibold text-foreground">
                      Join a pool
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Use an invite code you received
                    </span>
                  </span>
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl tracking-wide">
                  Join with invite code
                </DialogTitle>
                <DialogDescription>
                  Paste the code or invite link from your friend&apos;s pool.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleJoinSubmit} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="pool-invite-code">Invite code</Label>
                  <Input
                    id="pool-invite-code"
                    value={inviteCode}
                    onChange={(e) => {
                      setInviteCode(e.target.value)
                      setJoinError(null)
                    }}
                    placeholder="e.g. marketing-wc-2026"
                    autoComplete="off"
                    autoFocus
                  />
                  {joinError && (
                    <p className="text-sm text-destructive" role="alert">
                      {joinError}
                    </p>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setJoinError(null)
                      setStep('choose')
                    }}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Continue to join
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
