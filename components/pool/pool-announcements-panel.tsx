'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2, Megaphone, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { messageForCommissionerGate } from '@/src/lib/commissioner-entitlements'
import { capturePostHog } from '@/src/lib/posthog-client'
import {
  ANNOUNCEMENT_MAX_LENGTH,
  announcementWasEdited,
  fetchPoolAnnouncementsApi,
  postPoolAnnouncement,
  setAnnouncementPinnedApi,
  softDeletePoolAnnouncementApi,
  type PoolAnnouncement,
} from '@/src/lib/pool-announcements'
import { supabase } from '@/src/lib/supabase'

type Props = {
  poolId: string
  currentUserId: string
  isAdmin: boolean
  /** When banner candidate changes (post/pin/delete/dismiss refresh). */
  onBannerChange?: (announcement: PoolAnnouncement | null) => void
  className?: string
  /** Compact member-facing list without composer. */
  showComposer?: boolean
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function PoolAnnouncementsPanel({
  poolId,
  currentUserId,
  isAdmin,
  onBannerChange,
  className,
  showComposer = isAdmin,
}: Props) {
  const formId = useId()
  const [rows, setRows] = useState<PoolAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PoolAnnouncement | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [pinningId, setPinningId] = useState<string | null>(null)
  const viewedRef = useRef(false)
  const onBannerChangeRef = useRef(onBannerChange)
  onBannerChangeRef.current = onBannerChange

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchPoolAnnouncementsApi(poolId)
    if (result.error) {
      setError(result.error)
      setRows([])
      setLoading(false)
      return
    }
    setRows(result.rows)
    onBannerChangeRef.current?.(result.banner)
    if (!viewedRef.current) {
      viewedRef.current = true
      capturePostHog('announcement_viewed', {
        pool_id: poolId,
        count: result.rows.length,
      })
    }
    setLoading(false)
  }, [poolId])

  useEffect(() => {
    void load()
  }, [load])

  async function handlePost() {
    if (!isAdmin || posting) return
    setComposerError(null)
    setPosting(true)
    try {
      const result = await postPoolAnnouncement(
        supabase,
        poolId,
        currentUserId,
        draft,
      )
      if (!result.ok) {
        setComposerError(
          messageForCommissionerGate(result.error, result.error || 'Failed'),
        )
        toast.error(
          messageForCommissionerGate(
            result.error,
            result.error || 'Could not post announcement',
          ),
        )
        return
      }
      setDraft('')
      capturePostHog('announcement_posted', {
        pool_id: poolId,
        announcement_id: result.announcement.id,
      })
      toast.success('Announcement posted')
      void fetch('/api/notifications/notify-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId,
          announcementId: result.announcement.id,
          message: result.announcement.message,
        }),
      }).catch(() => {})
      await load()
    } finally {
      setPosting(false)
    }
  }

  async function handleSaveEdit() {
    if (!editingId || savingEdit || !isAdmin) return
    setSavingEdit(true)
    setComposerError(null)
    try {
      const res = await fetch(
        `/api/pools/${encodeURIComponent(poolId)}/announcements/${encodeURIComponent(editingId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: editDraft }),
        },
      )
      const data = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      if (!res.ok) {
        const msg = messageForCommissionerGate(
          data?.error,
          data?.error || 'Failed to update announcement',
        )
        setComposerError(msg)
        toast.error(msg)
        return
      }
      capturePostHog('announcement_edited', {
        pool_id: poolId,
        announcement_id: editingId,
      })
      toast.success('Announcement updated')
      setEditingId(null)
      setEditDraft('')
      await load()
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleTogglePin(row: PoolAnnouncement) {
    if (!isAdmin || pinningId) return
    setPinningId(row.id)
    try {
      const next = !row.pinned
      const result = await setAnnouncementPinnedApi(poolId, row.id, next)
      if (!result.ok) {
        toast.error(
          messageForCommissionerGate(result.error, result.error || 'Failed'),
        )
        return
      }
      capturePostHog('announcement_pinned', {
        pool_id: poolId,
        announcement_id: row.id,
        pinned: next,
      })
      toast.success(next ? 'Announcement pinned' : 'Announcement unpinned')
      await load()
    } finally {
      setPinningId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    try {
      const result = await softDeletePoolAnnouncementApi(
        poolId,
        pendingDelete.id,
      )
      if (!result.ok) {
        toast.error(
          messageForCommissionerGate(result.error, result.error || 'Failed'),
        )
        return
      }
      capturePostHog('announcement_deleted', {
        pool_id: poolId,
        announcement_id: pendingDelete.id,
      })
      toast.success('Announcement deleted')
      setPendingDelete(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {showComposer ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label
              htmlFor={`${formId}-composer`}
              className="text-sm font-medium text-foreground"
            >
              New announcement
            </Label>
            <Textarea
              id={`${formId}-composer`}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value.slice(0, ANNOUNCEMENT_MAX_LENGTH))
                setComposerError(null)
              }}
              placeholder="e.g. Lock in your picks before Friday kickoff"
              rows={3}
              maxLength={ANNOUNCEMENT_MAX_LENGTH}
              disabled={posting || !poolId}
              className={cn('min-h-[4.5rem] resize-y', FOCUS_VISIBLE_RING)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs tabular-nums text-muted-foreground">
              {draft.trim().length}/{ANNOUNCEMENT_MAX_LENGTH}
            </p>
            <Button
              type="button"
              size="lg"
              className={cn(
                'h-11 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto sm:min-w-[12rem]',
                FOCUS_VISIBLE_RING,
              )}
              disabled={posting || !poolId || draft.trim().length === 0}
              onClick={() => void handlePost()}
            >
              {posting ? 'Posting…' : 'Post announcement'}
            </Button>
          </div>
          {composerError ? (
            <div className="space-y-2">
              <p className="text-xs text-destructive" role="alert">
                {composerError}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn('h-8', FOCUS_VISIBLE_RING)}
                disabled={posting}
                onClick={() => void handlePost()}
              >
                Retry
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">
          {isAdmin ? 'Announcements' : 'Pool announcements'}
        </h4>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2
              className="h-5 w-5 animate-spin text-primary"
              aria-label="Loading announcements"
            />
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
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
            No announcements yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const edited = announcementWasEdited(row)
              const isEditing = editingId === row.id
              return (
                <li
                  key={row.id}
                  className={cn(
                    'rounded-xl border px-3 py-3',
                    row.pinned
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-border bg-card/40',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Megaphone
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        row.pinned ? 'text-primary' : 'text-muted-foreground',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      {row.pinned ? (
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Pinned
                        </p>
                      ) : null}
                      {isEditing ? (
                        <Textarea
                          value={editDraft}
                          onChange={(e) =>
                            setEditDraft(
                              e.target.value.slice(0, ANNOUNCEMENT_MAX_LENGTH),
                            )
                          }
                          rows={3}
                          maxLength={ANNOUNCEMENT_MAX_LENGTH}
                          disabled={savingEdit}
                          className={cn(
                            'min-h-[4rem] resize-y',
                            FOCUS_VISIBLE_RING,
                          )}
                          aria-label="Edit announcement"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {row.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {row.authorName || 'Commissioner'} ·{' '}
                        {formatWhen(row.createdAt)}
                        {edited && row.updatedAt
                          ? ` · edited ${formatWhen(row.updatedAt)}`
                          : ''}
                      </p>
                      {isAdmin ? (
                        <div className="flex flex-wrap gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                className={cn('h-8', FOCUS_VISIBLE_RING)}
                                disabled={savingEdit || !editDraft.trim()}
                                onClick={() => void handleSaveEdit()}
                              >
                                {savingEdit ? 'Saving…' : 'Save'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={cn('h-8', FOCUS_VISIBLE_RING)}
                                disabled={savingEdit}
                                onClick={() => {
                                  setEditingId(null)
                                  setEditDraft('')
                                }}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={cn('h-8 gap-1.5', FOCUS_VISIBLE_RING)}
                                disabled={Boolean(pinningId)}
                                onClick={() => void handleTogglePin(row)}
                              >
                                {row.pinned ? (
                                  <PinOff className="h-3.5 w-3.5" aria-hidden />
                                ) : (
                                  <Pin className="h-3.5 w-3.5" aria-hidden />
                                )}
                                {pinningId === row.id
                                  ? 'Updating…'
                                  : row.pinned
                                    ? 'Unpin'
                                    : 'Pin'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={cn('h-8 gap-1.5', FOCUS_VISIBLE_RING)}
                                onClick={() => {
                                  setEditingId(row.id)
                                  setEditDraft(row.message)
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={cn(
                                  'h-8 gap-1.5 text-destructive',
                                  FOCUS_VISIBLE_RING,
                                )}
                                onClick={() => setPendingDelete(row)}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (deleting) return
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent className={FOCUS_VISIBLE_RING}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the announcement from the pool for everyone. You can
              post a new one anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className={FOCUS_VISIBLE_RING}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmDelete()
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
