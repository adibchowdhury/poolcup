'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/src/lib/supabase'
import {
  deleteCurrentUserAccount,
  deleteUploadedAvatarFromStorage,
} from '@/src/lib/delete-account'

type DeleteAccountSectionProps = {
  userId: string
  avatar?: string | null
}

export function DeleteAccountSection({ userId, avatar }: DeleteAccountSectionProps) {
  const router = useRouter()
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = useMemo(() => typed.trim().toUpperCase() === 'DELETE', [typed])

  async function handleDeleteAccount() {
    if (!canDelete || deleting) return

    setDeleting(true)
    setError(null)

    try {
      await deleteUploadedAvatarFromStorage(userId, avatar)

      const { error: deleteError } = await deleteCurrentUserAccount()
      if (deleteError) {
        throw deleteError
      }

      await supabase.auth.signOut({ scope: 'local' })
      router.push('/?accountDeleted=1')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="space-y-2">
        <h3 className="font-display text-xl tracking-wide text-destructive">
          Danger zone
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Deleting your account is permanent and cannot be undone. This removes
          your account, every pool you created and{' '}
          <span className="font-medium text-foreground">
            all predictions other members made in those pools
          </span>
          , your own pool memberships, and your stats.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="delete-account-confirm">
          Type <span className="font-mono font-semibold text-foreground">DELETE</span>{' '}
          to enable deletion
        </Label>
        <Input
          id="delete-account-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          disabled={deleting}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="destructive"
        disabled={!canDelete || deleting}
        onClick={() => void handleDeleteAccount()}
      >
        {deleting ? 'Deleting account…' : 'Delete my account'}
      </Button>
    </div>
  )
}
