'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Crown,
  Loader2,
  Lock,
  Megaphone,
  Pencil,
  Shield,
  Trash2,
  Upload,
  UserMinus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  isPoolAvatarFilename,
  POOL_AVATAR_FILENAMES,
  resolvePoolAvatarFilename,
  type PoolAvatarFilename,
} from '@/src/lib/pool-avatars'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import {
  isPoolNameUnchanged,
  normalizePoolName,
  validatePoolName,
} from '@/src/lib/pool-name'
import {
  DEFAULT_POOL_THEME_COLOR,
  isValidPoolThemeHex,
  normalizePoolThemeColor,
  POOL_THEME_COLOR_PRESETS,
  resolvePoolThemeColor,
} from '@/src/lib/pool-theme'
import {
  CLASSIC_DEFAULT_DRAW_POINTS,
  CLASSIC_DEFAULT_EXACT_POINTS,
  CLASSIC_DEFAULT_WINNER_POINTS,
  CLASSIC_SCORE_POINTS_MAX,
  CLASSIC_SCORE_POINTS_MIN,
  parseScorePointsInput,
  resolveClassicScorePoints,
  scorePointsForDb,
} from '@/src/lib/classic-score-points'
import {
  clearPoolEmblem,
  uploadPoolEmblem,
} from '@/src/lib/upload-pool-emblem'
import {
  ANNOUNCEMENT_MAX_LENGTH,
  clearPoolAnnouncement,
  getLatestActiveAnnouncement,
  postPoolAnnouncement,
  type PoolAnnouncement,
} from '@/src/lib/pool-announcements'
import { supabase } from '@/src/lib/supabase'

type PoolSquadTabProps = {
  poolId?: string
  squadName: string
  poolAvatar: string | null
  poolEmblemUrl: string | null
  poolThemeColor: string | null
  scoringStyle: string
  scoreExactPoints: number | null
  scoreWinnerPoints: number | null
  scoreDrawPoints: number | null
  scoringLocked: boolean
  acceptingMembers: boolean
  members: LeaderboardMember[]
  poolCreatorUserId?: string
  currentUserId: string
  onPoolNameChange?: (name: string) => void
  onPoolAvatarChange?: (avatar: string) => void
  onPoolThemeColorChange?: (themeColor: string | null) => void
  onPoolEmblemUrlChange?: (emblemUrl: string | null) => void
  onPoolScoringChange?: (scoring: {
    scoreExactPoints: number | null
    scoreWinnerPoints: number | null
    scoreDrawPoints: number | null
  }) => void
  onAcceptingMembersChange?: (acceptingMembers: boolean) => void
  /** After a member is removed (cascade deletes their pool predictions). */
  onMemberRemoved?: (memberId: string) => void
  /**
   * Sync banner after commissioner posts or clears.
   * `null` = cleared / no active announcement for management.
   */
  onManagedAnnouncementChange?: (announcement: PoolAnnouncement | null) => void
}

export function PoolSquadTab({
  poolId,
  squadName,
  poolAvatar,
  poolEmblemUrl,
  poolThemeColor,
  scoringStyle,
  scoreExactPoints,
  scoreWinnerPoints,
  scoreDrawPoints,
  scoringLocked,
  acceptingMembers,
  members,
  poolCreatorUserId,
  currentUserId,
  onPoolNameChange,
  onPoolAvatarChange,
  onPoolThemeColorChange,
  onPoolEmblemUrlChange,
  onPoolScoringChange,
  onAcceptingMembersChange,
  onMemberRemoved,
  onManagedAnnouncementChange,
}: PoolSquadTabProps) {
  const isCaptain = Boolean(
    poolCreatorUserId && currentUserId === poolCreatorUserId,
  )
  const captain = poolCreatorUserId
    ? members.find((member) => member.userId === poolCreatorUserId)
    : undefined
  const roster = [...members].sort((a, b) => a.name.localeCompare(b.name))
  const playerLabel = members.length === 1 ? 'player' : 'players'
  const emblemInputRef = useRef<HTMLInputElement>(null)

  const [isEditingName, setIsEditingName] = useState(false)
  const [draftName, setDraftName] = useState(squadName)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [acceptingMembersError, setAcceptingMembersError] = useState<
    string | null
  >(null)
  const [savingAcceptingMembers, setSavingAcceptingMembers] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [customHex, setCustomHex] = useState(
    () => poolThemeColor ?? DEFAULT_POOL_THEME_COLOR,
  )
  const [savingTheme, setSavingTheme] = useState(false)
  const [themeError, setThemeError] = useState<string | null>(null)
  const [savingEmblem, setSavingEmblem] = useState(false)
  const [emblemError, setEmblemError] = useState<string | null>(null)
  const resolvedScoring = resolveClassicScorePoints({
    scoreExactPoints,
    scoreWinnerPoints,
    scoreDrawPoints,
  })
  const [draftExact, setDraftExact] = useState(String(resolvedScoring.exact))
  const [draftWinner, setDraftWinner] = useState(String(resolvedScoring.winner))
  const [draftDraw, setDraftDraw] = useState(String(resolvedScoring.draw))
  const [savingScoring, setSavingScoring] = useState(false)
  const [scoringError, setScoringError] = useState<string | null>(null)
  const [memberPendingRemove, setMemberPendingRemove] =
    useState<LeaderboardMember | null>(null)
  const [removingMember, setRemovingMember] = useState(false)
  const [draftAnnouncement, setDraftAnnouncement] = useState('')
  const [managedAnnouncement, setManagedAnnouncement] =
    useState<PoolAnnouncement | null>(null)
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(false)
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)
  const [clearingAnnouncement, setClearingAnnouncement] = useState(false)
  const [announcementError, setAnnouncementError] = useState<string | null>(
    null,
  )

  const isClassicPool = scoringStyle !== 'winner'
  const canEditScoring = isCaptain && isClassicPool && !scoringLocked

  useEffect(() => {
    if (!isEditingName) {
      setDraftName(squadName)
    }
  }, [squadName, isEditingName])

  useEffect(() => {
    setCustomHex(poolThemeColor ?? DEFAULT_POOL_THEME_COLOR)
  }, [poolThemeColor])

  useEffect(() => {
    const next = resolveClassicScorePoints({
      scoreExactPoints,
      scoreWinnerPoints,
      scoreDrawPoints,
    })
    setDraftExact(String(next.exact))
    setDraftWinner(String(next.winner))
    setDraftDraw(String(next.draw))
  }, [scoreExactPoints, scoreWinnerPoints, scoreDrawPoints])

  useEffect(() => {
    if (!isCaptain || !poolId) {
      setManagedAnnouncement(null)
      return
    }

    let cancelled = false
    setLoadingAnnouncement(true)
    void getLatestActiveAnnouncement(supabase, poolId).then((row) => {
      if (cancelled) return
      setManagedAnnouncement(row)
      setLoadingAnnouncement(false)
    })

    return () => {
      cancelled = true
    }
  }, [isCaptain, poolId])

  const validationError = validatePoolName(draftName)
  const canSave =
    Boolean(poolId) &&
    !validationError &&
    !isPoolNameUnchanged(squadName, draftName) &&
    !saving

  const effectiveTheme = resolvePoolThemeColor(poolThemeColor)

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
    toast.success('Squad name updated')
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
      setAcceptingMembersError(
        error.message || 'Failed to update invite settings',
      )
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
    toast.success('Squad photo updated')
  }

  async function handleSaveThemeColor(next: string | null) {
    if (!poolId || savingTheme) return

    const normalized = next == null ? null : normalizePoolThemeColor(next)
    if (next != null && !normalized) {
      setThemeError('Enter a valid hex color like #00e676')
      return
    }

    const previous = poolThemeColor
    onPoolThemeColorChange?.(normalized)
    setSavingTheme(true)
    setThemeError(null)

    const { error } = await supabase
      .from('pools')
      .update({ theme_color: normalized })
      .eq('id', poolId)

    setSavingTheme(false)

    if (error) {
      onPoolThemeColorChange?.(previous)
      setThemeError(error.message || 'Failed to update theme color')
      toast.error('Could not save theme color')
      return
    }

    toast.success(normalized ? 'Theme color saved' : 'Theme reset to default')
  }

  async function handleEmblemFile(file: File | undefined) {
    if (!poolId || !file || savingEmblem) return
    setSavingEmblem(true)
    setEmblemError(null)

    const result = await uploadPoolEmblem(supabase, poolId, file)
    setSavingEmblem(false)

    if (result.error || !result.publicUrl) {
      setEmblemError(result.error || 'Upload failed')
      toast.error(result.error || 'Could not upload emblem')
      return
    }

    onPoolEmblemUrlChange?.(result.publicUrl)
    toast.success('Emblem uploaded')
  }

  async function handleRemoveEmblem() {
    if (!poolId || savingEmblem || !poolEmblemUrl) return
    const previous = poolEmblemUrl
    onPoolEmblemUrlChange?.(null)
    setSavingEmblem(true)
    setEmblemError(null)

    const { error } = await clearPoolEmblem(supabase, poolId)
    setSavingEmblem(false)

    if (error) {
      onPoolEmblemUrlChange?.(previous)
      setEmblemError(error)
      toast.error('Could not remove emblem')
      return
    }

    toast.success('Emblem removed')
  }

  async function handleSaveScoring() {
    if (!poolId || !canEditScoring || savingScoring) return

    const exact = parseScorePointsInput(draftExact)
    const winner = parseScorePointsInput(draftWinner)
    const draw = parseScorePointsInput(draftDraw)

    if (exact == null || winner == null || draw == null) {
      setScoringError(
        `Enter whole numbers from ${CLASSIC_SCORE_POINTS_MIN}–${CLASSIC_SCORE_POINTS_MAX}`,
      )
      return
    }

    const nextExact = scorePointsForDb(exact, CLASSIC_DEFAULT_EXACT_POINTS)
    const nextWinner = scorePointsForDb(winner, CLASSIC_DEFAULT_WINNER_POINTS)
    const nextDraw = scorePointsForDb(draw, CLASSIC_DEFAULT_DRAW_POINTS)

    setSavingScoring(true)
    setScoringError(null)

    const { error } = await supabase
      .from('pools')
      .update({
        score_exact_points: nextExact,
        score_winner_points: nextWinner,
        score_draw_points: nextDraw,
      })
      .eq('id', poolId)

    setSavingScoring(false)

    if (error) {
      setScoringError(error.message || 'Failed to save scoring rules')
      toast.error('Could not save scoring rules')
      return
    }

    onPoolScoringChange?.({
      scoreExactPoints: nextExact,
      scoreWinnerPoints: nextWinner,
      scoreDrawPoints: nextDraw,
    })
    toast.success('Scoring rules saved')
  }

  function resetScoringDraftsToDefaults() {
    setDraftExact(String(CLASSIC_DEFAULT_EXACT_POINTS))
    setDraftWinner(String(CLASSIC_DEFAULT_WINNER_POINTS))
    setDraftDraw(String(CLASSIC_DEFAULT_DRAW_POINTS))
    setScoringError(null)
  }

  async function handleConfirmRemoveMember() {
    if (!poolId || !memberPendingRemove || removingMember) return
    if (memberPendingRemove.userId === poolCreatorUserId) return

    setRemovingMember(true)
    try {
      const res = await fetch('/api/remove-pool-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId,
          memberId: memberPendingRemove.id,
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to remove member')
      }
      onMemberRemoved?.(memberPendingRemove.id)
      toast.success(`${memberPendingRemove.name} removed from the pool`)
      setMemberPendingRemove(null)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not remove member',
      )
    } finally {
      setRemovingMember(false)
    }
  }

  async function handlePostAnnouncement() {
    if (!poolId || !isCaptain || postingAnnouncement) return
    setAnnouncementError(null)
    setPostingAnnouncement(true)
    try {
      const result = await postPoolAnnouncement(
        supabase,
        poolId,
        currentUserId,
        draftAnnouncement,
      )
      if (!result.ok) {
        setAnnouncementError(result.error)
        toast.error(result.error)
        return
      }
      setManagedAnnouncement(result.announcement)
      setDraftAnnouncement('')
      onManagedAnnouncementChange?.(result.announcement)
      toast.success('Announcement posted')
    } finally {
      setPostingAnnouncement(false)
    }
  }

  async function handleClearAnnouncement() {
    if (!managedAnnouncement || clearingAnnouncement) return
    setAnnouncementError(null)
    setClearingAnnouncement(true)
    try {
      const result = await clearPoolAnnouncement(
        supabase,
        managedAnnouncement.id,
      )
      if (!result.ok) {
        setAnnouncementError(result.error)
        toast.error(result.error)
        return
      }
      setManagedAnnouncement(null)
      onManagedAnnouncementChange?.(null)
      toast.success('Announcement cleared')
    } finally {
      setClearingAnnouncement(false)
    }
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-primary opacity-30 blur-lg" />
          <Users className="relative h-6 w-6 text-primary" />
        </div>
        <h2 className="font-display text-2xl tracking-wide text-foreground">
          MY SQUAD
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary" />

        <div className="space-y-6 p-4 sm:p-6">
          <div>
            <p className="text-sm text-muted-foreground">Squad emblem</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="relative w-fit">
                <PoolAvatarImage
                  avatar={poolAvatar}
                  emblemUrl={poolEmblemUrl}
                  size="lg"
                />
                {isCaptain ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full border border-border shadow-sm"
                    onClick={() => {
                      setAvatarError(null)
                      setPickerOpen((open) => !open)
                    }}
                    disabled={savingAvatar || savingEmblem}
                    aria-label={
                      pickerOpen ? 'Close photo picker' : 'Change squad photo'
                    }
                    aria-expanded={pickerOpen}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-2 sm:pt-1">
                {!isCaptain ? (
                  <p className="text-sm text-muted-foreground">
                    {poolEmblemUrl || poolAvatar
                      ? 'Branding chosen by the captain.'
                      : 'No squad emblem yet.'}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Upload a custom emblem, or pick a preset photo. Emblem
                      wins when both are set.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={emblemInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ''
                          void handleEmblemFile(file)
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        disabled={savingEmblem || !poolId}
                        onClick={() => emblemInputRef.current?.click()}
                      >
                        {savingEmblem ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Upload emblem
                      </Button>
                      {poolEmblemUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
                          disabled={savingEmblem}
                          onClick={() => void handleRemoveEmblem()}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Remove emblem
                        </Button>
                      ) : null}
                    </div>
                    {emblemError ? (
                      <p className="text-sm text-destructive" role="alert">
                        {emblemError}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {isCaptain && pickerOpen ? (
              <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">
                  Choose a preset squad photo
                </p>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
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
                        <Image
                          src={`/pool_avatars/${filename}`}
                          alt=""
                          width={72}
                          height={72}
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
                <Input
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(event.target.value)
                    setSaveError(null)
                  }}
                  disabled={saving}
                  aria-invalid={Boolean(validationError)}
                  aria-describedby={
                    validationError || saveError
                      ? 'squad-name-error'
                      : undefined
                  }
                  className="h-11 font-display text-lg tracking-wide sm:text-xl"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSaveName()}
                    disabled={!canSave}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
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
                <p className="min-w-0 flex-1 font-display text-2xl tracking-wide text-foreground sm:text-3xl">
                  {squadName}
                </p>
                {isCaptain ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={startEditing}
                    aria-label="Edit squad name"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          {isCaptain ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Theme color
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Accents this pool only — leaderboard, chat, and headers.
                </p>
              </div>

              <div
                className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/50 px-3 py-2.5"
                aria-hidden
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-full border border-white/15 shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_45%,transparent)]"
                  style={{ backgroundColor: effectiveTheme }}
                />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Live preview</p>
                  <p className="truncate font-mono text-sm text-primary">
                    {effectiveTheme}
                    {poolThemeColor == null ? ' · default' : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingTheme}
                  onClick={() => void handleSaveThemeColor(null)}
                  className={cn(
                    'h-9 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                    poolThemeColor == null
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                  title="Default PoolCup green"
                >
                  Default
                </button>
                {POOL_THEME_COLOR_PRESETS.map((preset) => {
                  const selected =
                    normalizePoolThemeColor(poolThemeColor) === preset.hex
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={savingTheme}
                      onClick={() => void handleSaveThemeColor(preset.hex)}
                      className={cn(
                        'h-9 w-9 rounded-full border-2 transition-transform hover:scale-105',
                        selected
                          ? 'border-foreground ring-2 ring-primary/40'
                          : 'border-white/15',
                      )}
                      style={{ backgroundColor: preset.hex }}
                      aria-label={preset.label}
                      aria-pressed={selected}
                      title={preset.label}
                    />
                  )
                })}
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label
                    htmlFor="pool-theme-hex"
                    className="text-xs text-muted-foreground"
                  >
                    Custom hex
                  </Label>
                  <Input
                    id="pool-theme-hex"
                    value={customHex}
                    onChange={(event) => {
                      setCustomHex(event.target.value)
                      setThemeError(null)
                    }}
                    placeholder="#00e676"
                    className="h-9 font-mono text-sm"
                    disabled={savingTheme}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={
                    savingTheme ||
                    !isValidPoolThemeHex(
                      customHex.startsWith('#')
                        ? customHex
                        : `#${customHex}`,
                    )
                  }
                  onClick={() => void handleSaveThemeColor(customHex)}
                >
                  {savingTheme ? 'Saving…' : 'Apply'}
                </Button>
              </div>
              {themeError ? (
                <p className="text-sm text-destructive" role="alert">
                  {themeError}
                </p>
              ) : null}
            </div>
          ) : null}

          {isClassicPool ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Scoring rules
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Set how many points predictions earn in this pool. Applies to
                  all matches in this pool.
                </p>
              </div>

              {scoringLocked ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Scoring is locked because matches have started.
                </p>
              ) : null}

              {canEditScoring ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label
                        htmlFor="score-exact-points"
                        className="text-xs text-muted-foreground"
                      >
                        Exact score
                      </Label>
                      <Input
                        id="score-exact-points"
                        type="number"
                        min={CLASSIC_SCORE_POINTS_MIN}
                        max={CLASSIC_SCORE_POINTS_MAX}
                        inputMode="numeric"
                        value={draftExact}
                        onChange={(event) => {
                          setDraftExact(event.target.value)
                          setScoringError(null)
                        }}
                        placeholder={String(CLASSIC_DEFAULT_EXACT_POINTS)}
                        className="h-9 tabular-nums"
                        disabled={savingScoring}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="score-winner-points"
                        className="text-xs text-muted-foreground"
                      >
                        Correct winner
                      </Label>
                      <Input
                        id="score-winner-points"
                        type="number"
                        min={CLASSIC_SCORE_POINTS_MIN}
                        max={CLASSIC_SCORE_POINTS_MAX}
                        inputMode="numeric"
                        value={draftWinner}
                        onChange={(event) => {
                          setDraftWinner(event.target.value)
                          setScoringError(null)
                        }}
                        placeholder={String(CLASSIC_DEFAULT_WINNER_POINTS)}
                        className="h-9 tabular-nums"
                        disabled={savingScoring}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="score-draw-points"
                        className="text-xs text-muted-foreground"
                      >
                        Correct draw
                      </Label>
                      <Input
                        id="score-draw-points"
                        type="number"
                        min={CLASSIC_SCORE_POINTS_MIN}
                        max={CLASSIC_SCORE_POINTS_MAX}
                        inputMode="numeric"
                        value={draftDraw}
                        onChange={(event) => {
                          setDraftDraw(event.target.value)
                          setScoringError(null)
                        }}
                        placeholder={String(CLASSIC_DEFAULT_DRAW_POINTS)}
                        className="h-9 tabular-nums"
                        disabled={savingScoring}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={savingScoring || !poolId}
                      onClick={() => void handleSaveScoring()}
                    >
                      {savingScoring ? 'Saving…' : 'Save scoring'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={savingScoring}
                      onClick={resetScoringDraftsToDefaults}
                    >
                      Reset to defaults
                    </Button>
                  </div>
                  {scoringError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {scoringError}
                    </p>
                  ) : null}
                </>
              ) : (
                <ul className="space-y-1.5 text-sm text-foreground">
                  <li className="flex justify-between gap-3 border-b border-border/50 py-1.5">
                    <span className="text-muted-foreground">Exact score</span>
                    <span className="font-display tabular-nums text-primary">
                      {resolvedScoring.exact} pts
                    </span>
                  </li>
                  <li className="flex justify-between gap-3 border-b border-border/50 py-1.5">
                    <span className="text-muted-foreground">
                      Correct winner
                    </span>
                    <span className="font-display tabular-nums text-primary">
                      {resolvedScoring.winner} pts
                    </span>
                  </li>
                  <li className="flex justify-between gap-3 py-1.5">
                    <span className="text-muted-foreground">Correct draw</span>
                    <span className="font-display tabular-nums text-primary">
                      {resolvedScoring.draw} pts
                    </span>
                  </li>
                </ul>
              )}
            </div>
          ) : null}

          {captain ? (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Captain
              </p>
              <div className="mt-2 flex items-center gap-3">
                <UserProfileLink
                  userId={captain.userId}
                  ariaLabel={`${captain.name}'s profile`}
                  className="shrink-0"
                >
                  <UserAvatarImage
                    avatar={captain.avatar}
                    customAvatarUrl={captain.customAvatarUrl}
                    className="h-10 w-10"
                  />
                </UserProfileLink>
                <div className="min-w-0">
                  <UserProfileLink
                    userId={captain.userId}
                    className="truncate font-medium text-foreground hover:underline"
                  >
                    {captain.name}
                  </UserProfileLink>
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

          {isCaptain ? (
            <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg tracking-wide text-foreground">
                    Commissioner tools
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Announce to the squad, manage who can join, remove members,
                    or close this pool. Branding and scoring are above.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background/60 px-3 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" aria-hidden />
                  <Label
                    htmlFor="pool-announcement-message"
                    className="text-sm font-medium text-foreground"
                  >
                    Announcement
                  </Label>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                  Members see this as a banner at the top of the pool until they
                  dismiss it.
                </p>

                {loadingAnnouncement ? (
                  <p className="mb-3 text-xs text-muted-foreground">
                    Loading…
                  </p>
                ) : managedAnnouncement ? (
                  <div className="mb-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Current
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {managedAnnouncement.message}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8"
                      disabled={clearingAnnouncement || postingAnnouncement}
                      onClick={() => void handleClearAnnouncement()}
                    >
                      {clearingAnnouncement ? 'Clearing…' : 'Clear announcement'}
                    </Button>
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-muted-foreground">
                    No active announcement.
                  </p>
                )}

                <Textarea
                  id="pool-announcement-message"
                  value={draftAnnouncement}
                  onChange={(e) => {
                    setDraftAnnouncement(
                      e.target.value.slice(0, ANNOUNCEMENT_MAX_LENGTH),
                    )
                    setAnnouncementError(null)
                  }}
                  placeholder="e.g. Lock in your picks before Friday kickoff"
                  rows={3}
                  maxLength={ANNOUNCEMENT_MAX_LENGTH}
                  disabled={postingAnnouncement || !poolId}
                  className="min-h-[4.5rem] resize-y"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {draftAnnouncement.trim().length}/{ANNOUNCEMENT_MAX_LENGTH}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={
                      postingAnnouncement ||
                      !poolId ||
                      draftAnnouncement.trim().length === 0
                    }
                    onClick={() => void handlePostAnnouncement()}
                  >
                    {postingAnnouncement ? 'Posting…' : 'Post announcement'}
                  </Button>
                </div>
                {announcementError ? (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {announcementError}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-border bg-background/60 px-3 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label
                      htmlFor="accepting-members-toggle"
                      className="text-sm font-medium text-foreground"
                    >
                      Open to new members
                    </Label>
                    <p
                      id="accepting-members-help"
                      className="text-xs leading-relaxed text-muted-foreground"
                    >
                      {acceptingMembers
                        ? 'Anyone with the invite link can join.'
                        : 'Closed — no new members can join. Soft-close preferred over deleting.'}
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
                {savingAcceptingMembers ? (
                  <p className="mt-2 text-xs text-muted-foreground">Saving…</p>
                ) : null}
                {acceptingMembers ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 h-8 gap-1.5"
                    disabled={savingAcceptingMembers || !poolId}
                    onClick={() => void handleAcceptingMembersToggle(false)}
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                    Close to new members
                  </Button>
                ) : null}
              </div>

              {poolId ? (
                <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-3">
                  <p className="text-sm font-medium text-foreground">
                    Danger zone
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Permanently deletes the pool, all members, and every
                    prediction. Prefer closing to new members instead.
                  </p>
                  <div className="mt-3">
                    <DeletePoolDialog
                      poolId={poolId}
                      poolName={squadName}
                      redirectTo="/dashboard"
                      triggerVariant="outline"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p
                id="accepting-members-help"
                className="text-sm text-muted-foreground"
              >
                {acceptingMembers
                  ? 'This squad is open to new members.'
                  : 'This squad is closed to new members.'}
              </p>
            </div>
          )}

          <div>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-lg tracking-wide text-foreground">
                {isCaptain ? 'Manage members' : 'Roster'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {members.length} {playerLabel}
              </p>
            </div>
            {isCaptain ? (
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                Removing a member permanently deletes their predictions and
                standing in this pool.
              </p>
            ) : null}

            {roster.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No members yet</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {roster.map((member) => {
                  const memberIsCaptain = member.userId === poolCreatorUserId
                  const canRemove =
                    isCaptain && !memberIsCaptain && Boolean(poolId)

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
                      <UserProfileLink
                        userId={member.userId}
                        ariaLabel={`${member.name}'s profile`}
                        className="shrink-0"
                      >
                        <UserAvatarImage
                          avatar={member.avatar}
                          customAvatarUrl={member.customAvatarUrl}
                          className={cn(
                            'h-9 w-9',
                            member.isYou && 'ring-2 ring-primary/40',
                          )}
                        />
                      </UserProfileLink>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <UserProfileLink
                            userId={member.userId}
                            className={cn(
                              'truncate text-sm font-medium hover:underline',
                              member.isYou
                                ? 'text-primary'
                                : 'text-foreground',
                            )}
                          >
                            {member.name}
                            {member.isYou ? ' (You)' : ''}
                          </UserProfileLink>
                          {memberIsCaptain ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#ffb300]/30 bg-[#ffb300]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ffb300]">
                              <Crown className="h-3 w-3" aria-hidden />
                              Captain
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {canRemove ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 gap-1.5 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setMemberPendingRemove(member)}
                          aria-label={`Remove ${member.name}`}
                        >
                          <UserMinus className="h-3.5 w-3.5" aria-hidden />
                          <span className="hidden sm:inline">Remove</span>
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={memberPendingRemove != null}
        onOpenChange={(open) => {
          if (!open && !removingMember) setMemberPendingRemove(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {memberPendingRemove?.name ?? 'this member'}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This permanently removes them from the pool and deletes all
                  of their predictions, group picks, and leaderboard standing
                  for this pool. This cannot be undone.
                </p>
                <p>
                  They can rejoin later if the pool is still open to new
                  members — but their old predictions will not come back.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingMember}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removingMember}
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmRemoveMember()
              }}
            >
              {removingMember ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Removing…
                </>
              ) : (
                'Remove member'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
