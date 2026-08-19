'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
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

type DeletePoolDialogProps = {
  poolId: string
  poolName: string
  redirectTo?: string
  onDeleted?: () => void
  triggerClassName?: string
  triggerVariant?: 'ghost' | 'outline' | 'danger'
  /** Icon-only trigger (no "Delete pool" label). */
  iconOnly?: boolean
  /**
   * If the trigger is placed inside a clickable card/Link, enable this to prevent
   * navigation while still allowing the dialog to open.
   */
  stopPropagation?: boolean
}

export function DeletePoolDialog({
  poolId,
  poolName,
  redirectTo,
  onDeleted,
  triggerClassName,
  triggerVariant = 'outline',
  iconOnly = false,
  stopPropagation = true,
}: DeletePoolDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = useMemo(
    () => typed.trim() === poolName.trim(),
    [typed, poolName],
  )

  async function handleDelete() {
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/delete-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      })

      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to delete pool')
      }

      setOpen(false)
      setTyped('')
      onDeleted?.()

      if (redirectTo) {
        router.push(redirectTo)
      }
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete pool')
    } finally {
      setSubmitting(false)
    }
  }

  const triggerBase = iconOnly
    ? 'inline-flex items-center justify-center rounded-md p-2 text-destructive hover:bg-destructive/10'
    : triggerVariant === 'ghost'
      ? 'inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-destructive hover:bg-destructive/10'
      : triggerVariant === 'danger'
        ? 'inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90'
        : cn(
            'inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/15',
          )

  return (
    <>
      <button
        type="button"
        className={cn(triggerBase, triggerClassName)}
        aria-label="Delete pool"
        onClick={(e) => {
          if (stopPropagation) {
            // Triggers often sit inside clickable cards/Links.
            e.preventDefault()
            e.stopPropagation()
          }
          setOpen(true)
        }}
      >
        <Trash2 className="h-4 w-4" />
        {!iconOnly && <span>Delete pool</span>}
      </button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setTyped('')
            setError(null)
            setSubmitting(false)
          }
        }}
      >
      <AlertDialogContent
        // Radix portals still bubble through the React tree. Without this, events inside
        // the modal can trigger the underlying clickable pool card. Use bubbling phase
        // so the buttons still receive the click.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => e.stopPropagation()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{poolName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the pool, members, and predictions. To confirm, type the
            pool name{' '}
            <span className="font-mono font-semibold text-foreground">{poolName}</span>{' '}
            exactly below.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label htmlFor="delete-confirm" className="text-sm font-medium">
            Type the pool name to enable deletion
          </label>
          <input
            id="delete-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={poolName}
            autoComplete="off"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              if (!canDelete || submitting) return
              void handleDelete()
            }}
            className={cn(
              'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              (!canDelete || submitting) && 'pointer-events-none opacity-50',
            )}
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

