'use client'

import { useEffect, useState } from 'react'
import { Crown, Pencil, Users } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { getAvatarSrc } from '@/src/lib/avatars'
import {
  isPoolAvatarFilename,
  POOL_AVATAR_FILENAMES,
  resolvePoolAvatarFilename,
  type PoolAvatarFilename,
} from '@/src/lib/pool-avatars'
import {
  isPoolNameUnchanged,
  normalizePoolName,
  validatePoolName,
} from '@/src/lib/pool-name'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import { supabase } from '../lib/supabase-mobile'
import { MobilePoolAvatarImage } from './mobile-pool-avatar-image'

type MobilePoolSquadReadonlyProps = {
  poolId: string
  squadName: string
  poolAvatar: string | null
  acceptingMembers: boolean
  members: LeaderboardMember[]
  poolCreatorUserId: string
  currentUserId: string
  onPoolNameChange?: (name: string) => void
  onPoolAvatarChange?: (avatar: string) => void
  onAcceptingMembersChange?: (acceptingMembers: boolean) => void
}

function MemberAvatar({
  member,
}: {
  member: Pick<LeaderboardMember, 'name' | 'avatar' | 'isYou'>
}) {
  const showImage = Boolean(member.avatar?.trim())

  return (
    <div
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold',
        member.isYou
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-foreground',
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getAvatarSrc(member.avatar)}
          alt=""
          className="size-9 shrink-0 object-cover object-top"
        />
      ) : (
        member.name.charAt(0).toUpperCase()
      )}
    </div>
  )
}

export function MobilePoolSquadReadonly({
  poolId,
  squadName,
  poolAvatar,
  acceptingMembers,
  members,
  poolCreatorUserId,
  currentUserId,
  onPoolNameChange,
  onPoolAvatarChange,
  onAcceptingMembersChange,
}: MobilePoolSquadReadonlyProps) {
  const isCaptain = currentUserId === poolCreatorUserId
  const captain = members.find((member) => member.userId === poolCreatorUserId)
  const roster = [...members].sort((a, b) => a.name.localeCompare(b.name))
  const playerLabel = members.length === 1 ? 'player' : 'players'

  const [isEditingName, setIsEditingName] = useState(false)
  const [draftName, setDraftName] = useState(squadName)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [acceptingMembersError, setAcceptingMembersError] = useState<string | null>(
    null,
  )
  const [savingAcceptingMembers, setSavingAcceptingMembers] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditingName) {
      setDraftName(squadName)
    }
  }, [squadName, isEditingName])

  const validationError = validatePoolName(draftName)
  const canSave =
    Boolean(poolId) &&
    !validationError &&
    !isPoolNameUnchanged(squadName, draftName) &&
    !saving

  function startEditing() {
    setDraftName(squadName)
    setSaveError(null)
    setIsEditingName(true)
  }

  function cancelEditing() {
    setDraftName(squadName)
    setSaveError(null)
    setIsEditingName(false)
  }

  async function handleSaveName() {
    if (!poolId || !canSave) return

    const trimmed = normalizePoolName(draftName)
    const errorMessage = validatePoolName(draftName)
    if (errorMessage) {
      setSaveError(errorMessage)
      return
    }

    setSaving(true)
    setSaveError(null)

    const { error } = await supabase
      .from('pools')
      .update({ name: trimmed })
      .eq('id', poolId)

    setSaving(false)

    if (error) {
      setSaveError(error.message || 'Failed to rename squad')
      return
    }

    onPoolNameChange?.(trimmed)
    setIsEditingName(false)
  }

  async function handleAcceptingMembersToggle(checked: boolean) {
    if (!poolId || savingAcceptingMembers) return

    setSavingAcceptingMembers(true)
    setAcceptingMembersError(null)

    const { error } = await supabase
      .from('pools')
      .update({ accepting_members: checked })
      .eq('id', poolId)

    setSavingAcceptingMembers(false)

    if (error) {
      setAcceptingMembersError(error.message || 'Failed to update invite settings')
      return
    }

    onAcceptingMembersChange?.(checked)
  }

  async function handleSelectPoolAvatar(filename: PoolAvatarFilename) {
    if (!poolId || savingAvatar) return

    const current = isPoolAvatarFilename(poolAvatar) ? poolAvatar : null
    if (current === filename) {
      setPickerOpen(false)
      return
    }

    setSavingAvatar(true)
    setAvatarError(null)

    const { error } = await supabase
      .from('pools')
      .update({ avatar: filename })
      .eq('id', poolId)

    setSavingAvatar(false)

    if (error) {
      setAvatarError(error.message || 'Failed to update squad photo')
      return
    }

    onPoolAvatarChange?.(filename)
    setPickerOpen(false)
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-primary opacity-30 blur-lg" />
          <Users className="relative h-6 w-6 text-primary" aria-hidden />
        </div>
        <h2 className="font-display text-2xl tracking-wide text-foreground">
          MY SQUAD
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary" />

        <div className="space-y-6 p-4">
          <div>
            <p className="text-sm text-muted-foreground">Squad photo</p>
            <div className="mt-3 flex flex-col gap-4">
              <div className="relative w-fit">
                <MobilePoolAvatarImage avatar={poolAvatar} size="lg" />
                {isCaptain ? (
                  <button
                    type="button"
                    className="absolute -bottom-2 -right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
                    onClick={() => {
                      setAvatarError(null)
                      setPickerOpen((open) => !open)
                    }}
                    disabled={savingAvatar}
                    aria-label={
                      pickerOpen ? 'Close squad photo picker' : 'Change squad photo'
                    }
                    aria-expanded={pickerOpen}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              {!isCaptain ? (
                <p className="text-sm text-muted-foreground">
                  {poolAvatar
                    ? 'Squad photo chosen by the captain.'
                    : 'No squad photo yet.'}
                </p>
              ) : null}
            </div>

            {isCaptain && pickerOpen ? (
              <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">
                  Choose a squad photo
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {POOL_AVATAR_FILENAMES.map((filename) => {
                    const isSelected =
                      resolvePoolAvatarFilename(poolAvatar) === filename

                    return (
                      <button
                        key={filename}
                        type="button"
                        disabled={savingAvatar}
                        onClick={() => void handleSelectPoolAvatar(filename)}
                        className={cn(
                          'overflow-hidden rounded-xl border-2 bg-card p-1 transition-colors',
                          isSelected
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-border hover:border-primary/50',
                          savingAvatar && 'opacity-60',
                        )}
                        aria-label={`Select ${filename}`}
                        aria-pressed={isSelected}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/pool_avatars/${filename}`}
                          alt=""
                          className="aspect-square w-full rounded-lg object-cover object-top"
                        />
                      </button>
                    )
                  })}
                </div>
                {savingAvatar ? (
                  <p className="text-xs text-muted-foreground">Saving…</p>
                ) : null}
                {avatarError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {avatarError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Squad name</p>
            {isEditingName ? (
              <div className="mt-2 space-y-3">
                <input
                  type="text"
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(event.target.value)
                    setSaveError(null)
                  }}
                  disabled={saving}
                  aria-invalid={Boolean(validationError)}
                  aria-describedby={
                    validationError || saveError ? 'squad-name-error' : undefined
                  }
                  className="h-11 w-full rounded-lg border border-input bg-muted/40 px-3 font-display text-lg tracking-wide text-foreground outline-none ring-ring focus-visible:ring-2"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveName()}
                    disabled={!canSave}
                    className="inline-flex min-h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="inline-flex min-h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
                {validationError || saveError ? (
                  <p
                    id="squad-name-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {validationError ?? saveError}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-1 flex items-start gap-2">
                <p className="min-w-0 flex-1 font-display text-2xl tracking-wide text-foreground">
                  {squadName}
                </p>
                {isCaptain ? (
                  <button
                    type="button"
                    className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    onClick={startEditing}
                    aria-label="Edit squad name"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {captain ? (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Captain
              </p>
              <div className="mt-2 flex items-center gap-3">
                <MemberAvatar member={captain} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {captain.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Pool creator</p>
                </div>
                <Crown
                  className="ml-auto h-5 w-5 shrink-0 text-[#ffb300]"
                  aria-hidden
                />
              </div>
            </div>
          ) : null}

          {isCaptain ? (
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Crown className="h-4 w-4 shrink-0" aria-hidden />
              You&apos;re the captain
            </p>
          ) : null}

          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            {isCaptain ? (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <label
                    htmlFor="accepting-members-toggle"
                    className="text-sm font-medium text-foreground"
                  >
                    Accepting new members
                  </label>
                  <p
                    id="accepting-members-help"
                    className="text-xs leading-relaxed text-muted-foreground"
                  >
                    {acceptingMembers
                      ? 'On: anyone with the invite link can join.'
                      : 'Off: no new members can join.'}
                  </p>
                  {acceptingMembersError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {acceptingMembersError}
                    </p>
                  ) : null}
                </div>
                <Switch
                  id="accepting-members-toggle"
                  checked={acceptingMembers}
                  onCheckedChange={(checked) =>
                    void handleAcceptingMembersToggle(checked)
                  }
                  disabled={savingAcceptingMembers || !poolId}
                  aria-describedby="accepting-members-help"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {acceptingMembers
                  ? 'This squad is open to new members.'
                  : 'This squad is closed to new members.'}
              </p>
            )}
            {isCaptain && savingAcceptingMembers ? (
              <p className="mt-2 text-xs text-muted-foreground">Saving…</p>
            ) : null}
          </div>

          <div>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-lg tracking-wide text-foreground">
                Roster
              </h3>
              <p className="text-sm text-muted-foreground">
                {members.length} {playerLabel}
              </p>
            </div>

            {roster.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No members yet</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {roster.map((member) => {
                  const memberIsCaptain = member.userId === poolCreatorUserId

                  return (
                    <li
                      key={member.id}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5',
                        member.isYou
                          ? 'border border-primary/30 bg-primary/10'
                          : 'bg-muted/20',
                      )}
                    >
                      <MemberAvatar member={member} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              'truncate text-sm font-medium',
                              member.isYou ? 'text-primary' : 'text-foreground',
                            )}
                          >
                            {member.name}
                            {member.isYou ? ' (You)' : ''}
                          </span>
                          {memberIsCaptain ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#ffb300]/30 bg-[#ffb300]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ffb300]">
                              <Crown className="h-3 w-3" aria-hidden />
                              Captain
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
