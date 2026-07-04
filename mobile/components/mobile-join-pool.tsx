'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { joinPoolMobile } from '../lib/join-pool-mobile'
import { supabase } from '../lib/supabase-mobile'

type MobileJoinPoolProps = {
  userId: string
  onBack: () => void
  onJoined: (poolId: string) => void | Promise<void>
}

function splitDisplayName(displayName: string): {
  firstName: string
  lastName: string
} {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export function MobileJoinPool({
  userId,
  onBack,
  onJoined,
}: MobileJoinPoolProps) {
  const [inviteInput, setInviteInput] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closedPoolName, setClosedPoolName] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function prefillName() {
      const { data: profile } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle()

      if (cancelled || !profile?.display_name) return

      const { firstName: first, lastName: last } = splitDisplayName(
        profile.display_name,
      )
      setFirstName(first)
      setLastName(last)
    }

    void prefillName()

    return () => {
      cancelled = true
    }
  }, [userId])

  async function handleJoin() {
    setError(null)
    setClosedPoolName(null)
    setSuccessMessage(null)
    setJoining(true)

    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const result = await joinPoolMobile(
      supabase,
      userId,
      inviteInput,
      displayName,
    )

    setJoining(false)

    if (result.status === 'not_found') {
      setError('This pool is not available. The invite link may be invalid.')
      return
    }

    if (result.status === 'closed') {
      setClosedPoolName(result.poolName)
      return
    }

    if (result.status === 'validation_error' || result.status === 'error') {
      setError(result.message)
      return
    }

    if (result.status === 'already_member') {
      await onJoined(result.poolId)
      return
    }

    setSuccessMessage(`Joined ${result.poolName}!`)
    window.setTimeout(() => {
      void onJoined(result.poolId)
    }, 400)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          aria-label="Back to pools"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl tracking-wide text-foreground">
            Join a pool
          </h2>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary" />

            <div className="space-y-5 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                  <UserPlus className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter an invite code or paste a full invite link from your
                  captain.
                </p>
              </div>

              <div>
                <label
                  htmlFor="join-invite-code"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Invite code or link
                </label>
                <input
                  id="join-invite-code"
                  type="text"
                  value={inviteInput}
                  onChange={(event) => {
                    setInviteInput(event.target.value)
                    setError(null)
                    setClosedPoolName(null)
                  }}
                  placeholder="abc12345 or https://…/join/abc12345"
                  autoComplete="off"
                  className="w-full rounded-lg border border-input bg-muted/40 px-4 py-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="join-first-name"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    First name
                  </label>
                  <input
                    id="join-first-name"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(event.target.value)
                      setError(null)
                    }}
                    placeholder="Alex"
                    className="w-full rounded-lg border border-input bg-muted/40 px-4 py-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="join-last-name"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    Last name
                  </label>
                  <input
                    id="join-last-name"
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => {
                      setLastName(event.target.value)
                      setError(null)
                    }}
                    placeholder="Jordan"
                    className="w-full rounded-lg border border-input bg-muted/40 px-4 py-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={joining || !inviteInput.trim()}
                onClick={() => void handleJoin()}
                className="flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joining ? 'Joining…' : 'Join pool'}
              </button>

              {successMessage ? (
                <p className="text-sm font-medium text-primary" role="status">
                  {successMessage}
                </p>
              ) : null}

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              {closedPoolName ? (
                <div
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
                  role="alert"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-400">
                    Not accepting members
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {closedPoolName}
                    </span>{' '}
                    is not accepting new members right now. Ask the captain to
                    reopen invites if you still want to join.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
