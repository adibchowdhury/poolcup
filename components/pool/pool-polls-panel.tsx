'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import {
  castPollVoteApi,
  createPollApi,
  deletePollApi,
  fetchPoolPollsApi,
  formatPollCloseLabel,
  POLL_OPTION_MAX,
  POLL_OPTIONS_MAX,
  POLL_OPTIONS_MIN,
  POLL_QUESTION_MAX,
  type PoolPoll,
  validatePollComposer,
} from '@/src/lib/pool-polls'

type Props = {
  poolId: string
  isAdmin: boolean
  /** Show create button / composer (admin only). */
  showComposer?: boolean
  className?: string
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PoolPollsPanel({
  poolId,
  isAdmin,
  showComposer = isAdmin,
  className,
}: Props) {
  const baseId = useId()
  const [polls, setPolls] = useState<PoolPoll[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [closesAtLocal, setClosesAtLocal] = useState('')
  const [composerError, setComposerError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [votingKey, setVotingKey] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PoolPoll | null>(null)
  const [deleting, setDeleting] = useState(false)
  const viewedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchPoolPollsApi(poolId)
    if (result.error) {
      setError(result.error)
      setPolls([])
      setLoading(false)
      return
    }
    setPolls(result.polls)
    if (!viewedRef.current) {
      viewedRef.current = true
      capturePostHog('poll_viewed', {
        pool_id: poolId,
        count: result.polls.length,
      })
    }
    setLoading(false)
  }, [poolId])

  useEffect(() => {
    void load()
  }, [load])

  function resetComposer() {
    setQuestion('')
    setOptions(['', ''])
    setClosesAtLocal('')
    setComposerError(null)
  }

  async function handleCreate() {
    if (!isAdmin || creating) return
    const validated = validatePollComposer({ question, options })
    if (!validated.ok) {
      setComposerError(validated.error)
      return
    }
    setCreating(true)
    setComposerError(null)
    try {
      const result = await createPollApi(poolId, {
        question: validated.question,
        options: validated.options,
        closesAt: closesAtLocal.trim() || null,
      })
      if (!result.ok) {
        setComposerError(result.error)
        toast.error(result.error)
        return
      }
      capturePostHog('poll_created', {
        pool_id: poolId,
        poll_id: result.pollId,
        options: validated.options.length,
      })
      toast.success('Poll created')
      setComposerOpen(false)
      resetComposer()
      await load()
    } finally {
      setCreating(false)
    }
  }

  async function handleVote(poll: PoolPoll, optionId: string) {
    if (poll.isClosed || votingKey) return
    const previous = poll.myOptionId
    if (previous === optionId) return

    const key = `${poll.pollId}:${optionId}`
    setVotingKey(key)

    // Optimistic update
    setPolls((prev) =>
      prev.map((p) => {
        if (p.pollId !== poll.pollId) return p
        const optionsNext = p.options.map((o) => {
          let votes = o.votes
          if (previous && o.optionId === previous) votes = Math.max(0, votes - 1)
          if (o.optionId === optionId) votes += 1
          return { ...o, votes }
        })
        const totalVotes = previous ? p.totalVotes : p.totalVotes + 1
        return {
          ...p,
          myOptionId: optionId,
          totalVotes,
          options: optionsNext,
        }
      }),
    )

    const result = await castPollVoteApi(poolId, poll.pollId, optionId)
    setVotingKey(null)
    if (!result.ok) {
      toast.error(result.error)
      await load()
      return
    }

    if (previous) {
      capturePostHog('poll_vote_changed', {
        pool_id: poolId,
        poll_id: poll.pollId,
        option_id: optionId,
      })
    } else {
      capturePostHog('poll_voted', {
        pool_id: poolId,
        poll_id: poll.pollId,
        option_id: optionId,
      })
    }
    await load()
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || deleting || !isAdmin) return
    setDeleting(true)
    try {
      const result = await deletePollApi(poolId, pendingDelete.pollId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      capturePostHog('poll_deleted', {
        pool_id: poolId,
        poll_id: pendingDelete.pollId,
      })
      toast.success('Poll deleted')
      setPendingDelete(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  const minClosesLocal = toDatetimeLocalValue(
    new Date(Date.now() + 5 * 60_000),
  )

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-foreground">Polls</h4>
          <p className="text-xs text-muted-foreground">
            Vote on commissioner questions. Results update live.
          </p>
        </div>
        {showComposer && isAdmin ? (
          <Button
            type="button"
            size="sm"
            className={cn('h-8 gap-1.5', FOCUS_VISIBLE_RING)}
            onClick={() => {
              resetComposer()
              setComposerOpen(true)
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Create poll
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading polls">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border px-4 py-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn('mt-2', FOCUS_VISIBLE_RING)}
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      ) : polls.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground">No polls yet.</p>
          {isAdmin ? (
            <Button
              type="button"
              size="sm"
              className={cn('mt-3', FOCUS_VISIBLE_RING)}
              onClick={() => {
                resetComposer()
                setComposerOpen(true)
              }}
            >
              Create the first poll
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {polls.map((poll) => {
            const closeLabel = formatPollCloseLabel(
              poll.closesAt,
              poll.isClosed,
            )
            const total = Math.max(poll.totalVotes, 0)
            const groupName = `${baseId}-poll-${poll.pollId}`
            return (
              <li
                key={poll.pollId}
                className="rounded-xl border border-border bg-card/40 px-3 py-3 sm:px-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{poll.question}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {poll.isClosed ? 'Voting closed' : 'Open for voting'}
                      {closeLabel ? ` · ${closeLabel}` : ''}
                      {` · ${total} vote${total === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  {isAdmin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(
                        'h-8 shrink-0 gap-1.5 text-destructive',
                        FOCUS_VISIBLE_RING,
                      )}
                      onClick={() => setPendingDelete(poll)}
                      aria-label="Delete poll"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  ) : null}
                </div>

                <div
                  role="radiogroup"
                  aria-label={poll.question}
                  aria-disabled={poll.isClosed}
                  className="mt-3 space-y-2"
                >
                  {poll.options.map((opt) => {
                    const pct =
                      total > 0
                        ? Math.round((opt.votes / total) * 100)
                        : 0
                    const selected = poll.myOptionId === opt.optionId
                    const disabled =
                      poll.isClosed || votingKey?.startsWith(`${poll.pollId}:`)
                    return (
                      <div key={opt.optionId} className="space-y-1">
                        <label
                          className={cn(
                            'flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors',
                            selected
                              ? 'border-primary/50 bg-primary/10'
                              : 'border-border/70 hover:border-border',
                            poll.isClosed && 'cursor-default',
                            FOCUS_VISIBLE_RING,
                          )}
                        >
                          <input
                            type="radio"
                            name={groupName}
                            value={opt.optionId}
                            checked={selected}
                            disabled={disabled}
                            onChange={() => void handleVote(poll, opt.optionId)}
                            className="mt-1"
                          />
                          <span className="min-w-0 flex-1 text-sm text-foreground">
                            {opt.label}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {opt.votes} · {pct}%
                          </span>
                        </label>
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-muted"
                          aria-hidden
                        >
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              selected ? 'bg-primary' : 'bg-primary/50',
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {poll.isClosed ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Final results
                  </p>
                ) : poll.myOptionId ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    You can change your vote until the poll closes.
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <Dialog
        open={composerOpen}
        onOpenChange={(open) => {
          if (creating) return
          setComposerOpen(open)
          if (!open) resetComposer()
        }}
      >
        <DialogContent className={cn('sm:max-w-md', FOCUS_VISIBLE_RING)}>
          <DialogHeader>
            <DialogTitle>Create a poll</DialogTitle>
            <DialogDescription>
              Ask a question with {POLL_OPTIONS_MIN}–{POLL_OPTIONS_MAX} options.
              Members can vote once and change until close.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${baseId}-question`}>Question</Label>
              <Input
                id={`${baseId}-question`}
                value={question}
                maxLength={POLL_QUESTION_MAX}
                onChange={(e) => {
                  setQuestion(e.target.value)
                  setComposerError(null)
                }}
                placeholder="Who wins the group?"
                className={FOCUS_VISIBLE_RING}
                disabled={creating}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Options</legend>
              {options.map((opt, index) => (
                <div key={index} className="flex gap-2">
                  <Label
                    htmlFor={`${baseId}-opt-${index}`}
                    className="sr-only"
                  >
                    Option {index + 1}
                  </Label>
                  <Input
                    id={`${baseId}-opt-${index}`}
                    value={opt}
                    maxLength={POLL_OPTION_MAX}
                    onChange={(e) => {
                      const next = [...options]
                      next[index] = e.target.value
                      setOptions(next)
                      setComposerError(null)
                    }}
                    placeholder={`Option ${index + 1}`}
                    className={FOCUS_VISIBLE_RING}
                    disabled={creating}
                  />
                  {options.length > POLL_OPTIONS_MIN ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className={cn('shrink-0', FOCUS_VISIBLE_RING)}
                      disabled={creating}
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() =>
                        setOptions((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
              {options.length < POLL_OPTIONS_MAX ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn('h-8 gap-1.5', FOCUS_VISIBLE_RING)}
                  disabled={creating}
                  onClick={() => setOptions((prev) => [...prev, ''])}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add option
                </Button>
              ) : null}
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor={`${baseId}-closes`}>
                Closes at (optional)
              </Label>
              <Input
                id={`${baseId}-closes`}
                type="datetime-local"
                min={minClosesLocal}
                value={closesAtLocal}
                onChange={(e) => {
                  setClosesAtLocal(e.target.value)
                  setComposerError(null)
                }}
                className={FOCUS_VISIBLE_RING}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to keep voting open until you delete the poll.
              </p>
            </div>

            {composerError ? (
              <p className="text-sm text-destructive" role="alert">
                {composerError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={FOCUS_VISIBLE_RING}
              disabled={creating}
              onClick={() => setComposerOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={FOCUS_VISIBLE_RING}
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              {creating ? 'Creating…' : 'Create poll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (deleting) return
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent className={FOCUS_VISIBLE_RING}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this poll?</AlertDialogTitle>
            <AlertDialogDescription>
              Voting ends and the poll is removed from the list. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className={FOCUS_VISIBLE_RING}
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmDelete()
              }}
            >
              {deleting ? 'Deleting…' : 'Delete poll'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
