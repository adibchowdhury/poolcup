'use client'

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import {
  Check,
  Crown,
  ImagePlus,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserMinus,
  Users,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { CommissionerCoAdminsSection } from '@/components/pool/commissioner-co-admins-section'
import { CommissionerMissingPredictions } from '@/components/pool/commissioner-missing-predictions'
import { CommissionerModerationLog } from '@/components/pool/commissioner-moderation-log'
import { PoolAnnouncementsPanel } from '@/components/pool/pool-announcements-panel'
import { PoolExportsSection } from '@/components/pool/pool-exports-section'
import { PoolPollsPanel } from '@/components/pool/pool-polls-panel'
import { PoolScoringHistory } from '@/components/pool/pool-scoring-history'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'
import { LeavePoolDialog } from '@/components/pool/leave-pool-dialog'
import { PoolInviteCard } from '@/components/pool/pool-invite-card'
import { PoolAvatarImage } from '@/components/pool/pool-avatar-image'
import { TransferOwnershipDialog } from '@/components/pool/transfer-ownership-dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import {
  isPoolNameUnchanged,
  normalizePoolDescription,
  normalizePoolName,
  POOL_DESCRIPTION_MAX_LENGTH,
  validatePoolDescription,
  validatePoolName,
} from '@/src/lib/pool-name'
import {
  DEFAULT_POOL_THEME_COLOR,
  evaluateThemeContrast,
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
  resolveClassicScorePoints,
  scorePointsForDb,
  validateClassicScoringPoints,
} from '@/src/lib/classic-score-points'
import type { PoolAnnouncement } from '@/src/lib/pool-announcements'
import { patchPoolSettings } from '@/src/lib/pool-settings-client'
import { capturePostHog } from '@/src/lib/posthog-client'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { supabase } from '@/src/lib/supabase'
import { uploadPoolEmblem } from '@/src/lib/upload-pool-emblem'

type PoolSettingsTabProps = {
  poolId?: string
  poolName: string
  poolDescription?: string | null
  inviteCode?: string
  poolThemeColor: string | null
  poolAvatar?: string | null
  poolEmblemUrl?: string | null
  scoringStyle: string
  scoreExactPoints: number | null
  scoreWinnerPoints: number | null
  scoreDrawPoints: number | null
  scoringLocked: boolean
  acceptingMembers: boolean
  members: LeaderboardMember[]
  poolCreatorUserId?: string
  currentUserId: string
  /** Owner or co-commissioner (server-verified when possible). */
  isAdmin?: boolean
  /** Pool owner (creator_id). */
  isOwner?: boolean
  /** userIds currently in pool_admins (co-commissioners). */
  coAdminUserIds?: string[]
  onPoolNameChange?: (name: string) => void
  onPoolDescriptionChange?: (description: string | null) => void
  onPoolThemeColorChange?: (themeColor: string | null) => void
  onPoolEmblemUrlChange?: (emblemUrl: string | null) => void
  onPoolScoringChange?: (scoring: {
    scoreExactPoints: number | null
    scoreWinnerPoints: number | null
    scoreDrawPoints: number | null
  }) => void
  onAcceptingMembersChange?: (acceptingMembers: boolean) => void
  onMemberRemoved?: (memberId: string) => void
  onOwnershipTransferred?: (newOwnerUserId: string) => void
  onManagedAnnouncementChange?: (announcement: PoolAnnouncement | null) => void
}

function SectionHeading({
  title,
  trailing,
}: {
  title: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h3 className="shrink-0 font-display text-lg tracking-wide text-foreground">
        {title}
      </h3>
      <div className="h-px min-w-0 flex-1 bg-gradient-to-r from-border to-transparent" />
      {trailing}
    </div>
  )
}

function SubsectionHeading({
  title,
  tone = 'default',
}: {
  title: string
  tone?: 'default' | 'danger'
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h4
        className={cn(
          'shrink-0 text-sm font-semibold tracking-wide',
          tone === 'danger' ? 'text-destructive' : 'text-foreground',
        )}
      >
        {title}
      </h4>
      <div
        className={cn(
          'h-px min-w-0 flex-1',
          tone === 'danger'
            ? 'bg-gradient-to-r from-destructive/40 to-transparent'
            : 'bg-gradient-to-r from-border to-transparent',
        )}
      />
    </div>
  )
}

export function PoolSettingsTab({
  poolId,
  poolName,
  poolDescription = null,
  inviteCode,
  poolThemeColor,
  poolAvatar = null,
  poolEmblemUrl = null,
  scoringStyle,
  scoreExactPoints,
  scoreWinnerPoints,
  scoreDrawPoints,
  scoringLocked,
  acceptingMembers,
  members,
  poolCreatorUserId,
  currentUserId,
  isAdmin: isAdminProp,
  isOwner: isOwnerProp,
  coAdminUserIds = [],
  onPoolNameChange,
  onPoolDescriptionChange,
  onPoolThemeColorChange,
  onPoolEmblemUrlChange,
  onPoolScoringChange,
  onAcceptingMembersChange,
  onMemberRemoved,
  onOwnershipTransferred,
  onManagedAnnouncementChange,
}: PoolSettingsTabProps) {
  const isOwner =
    typeof isOwnerProp === 'boolean'
      ? isOwnerProp
      : Boolean(poolCreatorUserId && currentUserId === poolCreatorUserId)
  const isAdmin =
    typeof isAdminProp === 'boolean' ? isAdminProp : isOwner
  /** @deprecated alias — prefer isOwner */
  const isCreator = isOwner
  const coAdminIdSet = new Set(coAdminUserIds)
  const [transferOpen, setTransferOpen] = useState(false)
  const roster = [...members].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return a.name.localeCompare(b.name)
  })
  const playerLabel = members.length === 1 ? 'player' : 'players'
  const missingPredictionCount = members.filter((m) => {
    // Soft activity: members with 0 exact scores and 0 points look inactive.
    return m.points <= 0
  }).length

  const [isEditingName, setIsEditingName] = useState(false)
  const [draftName, setDraftName] = useState(poolName)
  const [draftDescription, setDraftDescription] = useState(
    poolDescription ?? '',
  )
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [savingDescription, setSavingDescription] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [acceptingMembersError, setAcceptingMembersError] = useState<
    string | null
  >(null)
  const [savingAcceptingMembers, setSavingAcceptingMembers] = useState(false)
  const [customHex, setCustomHex] = useState(
    () => poolThemeColor ?? DEFAULT_POOL_THEME_COLOR,
  )
  const [savingTheme, setSavingTheme] = useState(false)
  const [themeError, setThemeError] = useState<string | null>(null)
  const [contrastConfirmOpen, setContrastConfirmOpen] = useState(false)
  const [pendingThemeColor, setPendingThemeColor] = useState<string | null>(
    null,
  )
  const [contrastWarningFiredFor, setContrastWarningFiredFor] = useState<
    string | null
  >(null)
  const emblemInputRef = useRef<HTMLInputElement>(null)
  const [emblemBusy, setEmblemBusy] = useState(false)
  const [emblemError, setEmblemError] = useState<string | null>(null)
  const emblemFileInputId = useId()
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
  const [scoringConfirmOpen, setScoringConfirmOpen] = useState(false)
  const [scoringHistoryKey, setScoringHistoryKey] = useState(0)
  const [lastRecalcResult, setLastRecalcResult] = useState<string | null>(null)
  const scoringPreviewedRef = useRef(false)
  const scoringFormId = useId()
  const [memberPendingRemove, setMemberPendingRemove] =
    useState<LeaderboardMember | null>(null)
  const [removingMember, setRemovingMember] = useState(false)
  const [colorsExpanded, setColorsExpanded] = useState(false)

  const isClassicPool = scoringStyle !== 'winner'
  const canEditScoring = isAdmin && isClassicPool

  const draftScoringPreview = validateClassicScoringPoints({
    exact: draftExact.trim() === '' ? NaN : Number(draftExact),
    winner: draftWinner.trim() === '' ? NaN : Number(draftWinner),
    draw: draftDraw.trim() === '' ? NaN : Number(draftDraw),
  })

  useEffect(() => {
    if (!canEditScoring || !draftScoringPreview.ok || scoringPreviewedRef.current) {
      return
    }
    scoringPreviewedRef.current = true
    capturePostHog('scoring_previewed', {
      pool_id: poolId,
      exact: draftScoringPreview.exact,
      winner: draftScoringPreview.winner,
      draw: draftScoringPreview.draw,
    })
  }, [canEditScoring, draftScoringPreview, poolId])

  useEffect(() => {
    if (!isEditingName) {
      setDraftName(poolName)
    }
  }, [poolName, isEditingName])

  useEffect(() => {
    setDraftDescription(poolDescription ?? '')
  }, [poolDescription])

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

  const validationError = validatePoolName(draftName)
  const canSave =
    Boolean(poolId) &&
    !validationError &&
    !isPoolNameUnchanged(poolName, draftName) &&
    !saving

  const effectiveTheme = resolvePoolThemeColor(poolThemeColor)
  const draftThemeForContrast = (() => {
    const candidate = customHex.startsWith('#') ? customHex : `#${customHex}`
    return isValidPoolThemeHex(candidate)
      ? normalizePoolThemeColor(candidate)
      : poolThemeColor
  })()
  const themeContrast = evaluateThemeContrast(draftThemeForContrast)

  function startEditing() {
    setDraftName(poolName)
    setSaveError(null)
    setIsEditingName(true)
  }

  function cancelEditing() {
    setDraftName(poolName)
    setSaveError(null)
    setIsEditingName(false)
  }

  async function handleSaveName() {
    if (!poolId || !canSave || !isAdmin) return

    const trimmed = normalizePoolName(draftName)
    const errorMessage = validatePoolName(draftName)
    if (errorMessage) {
      setSaveError(errorMessage)
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await patchPoolSettings(poolId, { name: trimmed })
    setSaving(false)

    if (!result.success) {
      setSaveError(result.error || 'Failed to rename pool')
      return
    }

    onPoolNameChange?.(result.pool?.name ?? trimmed)
    setIsEditingName(false)
    capturePostHog('commissioner_action', {
      action: 'name_edited',
      pool_id: poolId,
    })
    toast.success('Pool name updated')
  }

  async function handleSaveDescription() {
    if (!poolId || !isAdmin || savingDescription) return
    const errorMessage = validatePoolDescription(draftDescription)
    if (errorMessage) {
      setDescriptionError(errorMessage)
      return
    }
    setSavingDescription(true)
    setDescriptionError(null)
    const next = normalizePoolDescription(draftDescription) || null
    const result = await patchPoolSettings(poolId, { description: next })
    setSavingDescription(false)
    if (!result.success) {
      setDescriptionError(result.error || 'Failed to save description')
      return
    }
    onPoolDescriptionChange?.(result.pool?.description ?? next)
    capturePostHog('commissioner_action', {
      action: 'description_edited',
      pool_id: poolId,
    })
    toast.success('Description saved')
  }

  async function handleAcceptingMembersToggle(checked: boolean) {
    if (!poolId || savingAcceptingMembers || !isAdmin) return

    setSavingAcceptingMembers(true)
    setAcceptingMembersError(null)

    const result = await patchPoolSettings(poolId, {
      acceptingMembers: checked,
    })
    setSavingAcceptingMembers(false)

    if (!result.success) {
      setAcceptingMembersError(
        result.error || 'Failed to update invite settings',
      )
      return
    }

    onAcceptingMembersChange?.(
      result.pool?.acceptingMembers ?? checked,
    )
    capturePostHog('commissioner_action', {
      action: checked ? 'pool_opened' : 'pool_closed',
      pool_id: poolId,
    })
  }

  async function persistThemeColor(next: string | null) {
    if (!poolId || savingTheme || !isAdmin) return

    const normalized = next == null ? null : normalizePoolThemeColor(next)
    if (next != null && !normalized) {
      setThemeError('Enter a valid hex color like #00e676')
      return
    }

    const previous = poolThemeColor
    onPoolThemeColorChange?.(normalized)
    setSavingTheme(true)
    setThemeError(null)

    const result = await patchPoolSettings(poolId, { themeColor: normalized })
    setSavingTheme(false)

    if (!result.success) {
      onPoolThemeColorChange?.(previous)
      setThemeError(result.error || 'Failed to update theme color')
      toast.error('Could not save pool color')
      return
    }

    onPoolThemeColorChange?.(result.pool?.themeColor ?? normalized)
    capturePostHog('commissioner_action', {
      action: 'theme_edited',
      pool_id: poolId,
    })
    capturePostHog('branding_color_changed', {
      pool_id: poolId,
      theme_color: normalized,
    })
    toast.success(normalized ? 'Pool color saved' : 'Pool color reset to default')
  }

  function handleSaveThemeColor(next: string | null) {
    if (!poolId || savingTheme || !isAdmin) return

    const normalized = next == null ? null : normalizePoolThemeColor(next)
    if (next != null && !normalized) {
      setThemeError('Enter a valid hex color like #00e676')
      return
    }

    const contrast = evaluateThemeContrast(normalized)
    if (!contrast.ok) {
      const key = normalized ?? 'default'
      if (contrastWarningFiredFor !== key) {
        capturePostHog('branding_contrast_warning_shown', {
          pool_id: poolId,
          theme_color: normalized,
        })
        setContrastWarningFiredFor(key)
      }
      setPendingThemeColor(normalized)
      setContrastConfirmOpen(true)
      return
    }

    void persistThemeColor(normalized)
  }

  async function handleEmblemFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !poolId || !isAdmin || emblemBusy) return

    setEmblemBusy(true)
    setEmblemError(null)

    const upload = await uploadPoolEmblem(supabase, poolId, file)
    if (upload.error || !upload.publicUrl) {
      setEmblemBusy(false)
      setEmblemError(upload.error || 'Upload failed')
      toast.error('Could not upload logo')
      return
    }

    const previous = poolEmblemUrl
    onPoolEmblemUrlChange?.(upload.publicUrl)
    const result = await patchPoolSettings(poolId, {
      emblemUrl: upload.publicUrl,
    })
    setEmblemBusy(false)

    if (!result.success) {
      onPoolEmblemUrlChange?.(previous)
      setEmblemError(result.error || 'Could not save logo')
      toast.error('Could not save logo')
      return
    }

    const saved = result.pool?.emblemUrl ?? upload.publicUrl
    onPoolEmblemUrlChange?.(saved)
    capturePostHog('branding_logo_uploaded', { pool_id: poolId })
    toast.success('Pool logo saved')
  }

  async function handleRemoveEmblem() {
    if (!poolId || !isAdmin || emblemBusy || !poolEmblemUrl) return

    setEmblemBusy(true)
    setEmblemError(null)
    const previous = poolEmblemUrl
    onPoolEmblemUrlChange?.(null)

    const result = await patchPoolSettings(poolId, { emblemUrl: null })
    setEmblemBusy(false)

    if (!result.success) {
      onPoolEmblemUrlChange?.(previous)
      setEmblemError(result.error || 'Could not remove logo')
      toast.error('Could not remove logo')
      return
    }

    onPoolEmblemUrlChange?.(result.pool?.emblemUrl ?? null)
    capturePostHog('branding_logo_removed', { pool_id: poolId })
    toast.success('Pool logo removed')
  }

  async function persistScoring(opts: { confirmRecalculate: boolean }) {
    if (!poolId || !canEditScoring || savingScoring) return

    const validated = validateClassicScoringPoints({
      exact: draftExact.trim() === '' ? NaN : Number(draftExact),
      winner: draftWinner.trim() === '' ? NaN : Number(draftWinner),
      draw: draftDraw.trim() === '' ? NaN : Number(draftDraw),
    })
    if (!validated.ok) {
      setScoringError(validated.error)
      return
    }

    const nextExact = scorePointsForDb(
      validated.exact,
      CLASSIC_DEFAULT_EXACT_POINTS,
    )
    const nextWinner = scorePointsForDb(
      validated.winner,
      CLASSIC_DEFAULT_WINNER_POINTS,
    )
    const nextDraw = scorePointsForDb(
      validated.draw,
      CLASSIC_DEFAULT_DRAW_POINTS,
    )

    setSavingScoring(true)
    setScoringError(null)
    setLastRecalcResult(null)

    const result = await patchPoolSettings(poolId, {
      scoreExactPoints: nextExact,
      scoreWinnerPoints: nextWinner,
      scoreDrawPoints: nextDraw,
      confirmRecalculate: opts.confirmRecalculate || undefined,
    })
    setSavingScoring(false)

    if (result.needsConfirmation) {
      setScoringConfirmOpen(true)
      return
    }

    if (!result.success) {
      setScoringError(result.error || 'Failed to save scoring rules')
      toast.error('Could not save scoring rules')
      return
    }

    if (result.warning === 'scoring_saved_recalc_failed') {
      setScoringError(
        'Scoring saved, but recalculation failed. Retry save to rescore.',
      )
      toast.error('Saved, but recalculation failed')
    }

    onPoolScoringChange?.({
      scoreExactPoints: result.pool?.scoreExactPoints ?? nextExact,
      scoreWinnerPoints: result.pool?.scoreWinnerPoints ?? nextWinner,
      scoreDrawPoints: result.pool?.scoreDrawPoints ?? nextDraw,
    })
    setScoringHistoryKey((k) => k + 1)
    setScoringConfirmOpen(false)

    capturePostHog('scoring_config_saved', {
      pool_id: poolId,
      exact: validated.exact,
      winner: validated.winner,
      draw: validated.draw,
      recalculated: Boolean(result.recalculated),
    })
    capturePostHog('commissioner_action', {
      action: 'scoring_edited',
      pool_id: poolId,
    })

    if (result.recalculated) {
      const n = result.matchesRescored ?? 0
      const message = `Rescored ${n} match${n === 1 ? '' : 'es'}; leaderboard updated`
      setLastRecalcResult(message)
      capturePostHog('scoring_recalculated', {
        pool_id: poolId,
        matches_rescored: n,
      })
      toast.success(message)
    } else {
      toast.success('Scoring rules saved')
    }
  }

  function handleSaveScoringClick() {
    if (!poolId || !canEditScoring || savingScoring) return
    const validated = validateClassicScoringPoints({
      exact: draftExact.trim() === '' ? NaN : Number(draftExact),
      winner: draftWinner.trim() === '' ? NaN : Number(draftWinner),
      draw: draftDraw.trim() === '' ? NaN : Number(draftDraw),
    })
    if (!validated.ok) {
      setScoringError(validated.error)
      return
    }
    setScoringError(null)
    if (scoringLocked) {
      setScoringConfirmOpen(true)
      return
    }
    void persistScoring({ confirmRecalculate: false })
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
    const targetIsCoAdmin = coAdminIdSet.has(memberPendingRemove.userId)
    if (!isOwner && targetIsCoAdmin) return

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
      capturePostHog('commissioner_action', {
        action: 'member_removed',
        pool_id: poolId,
      })
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


  return (
    <div className="w-full min-w-0 space-y-8">
      <section>
        <SectionHeading title="Pool name" />
        {isEditingName ? (
          <div className="max-w-md space-y-3">
            <Input
              value={draftName}
              onChange={(event) => {
                setDraftName(event.target.value)
                setSaveError(null)
              }}
              disabled={saving}
              aria-invalid={Boolean(validationError)}
              aria-describedby={
                validationError || saveError ? 'pool-name-error' : undefined
              }
              className="h-11 font-display text-xl tracking-wide sm:text-2xl"
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
                id="pool-name-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {validationError ?? saveError}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="font-display text-2xl tracking-wide text-foreground sm:text-3xl">
              {poolName}
            </p>
            {isAdmin ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={startEditing}
                aria-label="Edit pool name"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        )}
      </section>

      {isAdmin ? (
        <section className="space-y-3">
          <SectionHeading title="Description" />
          <Textarea
            value={draftDescription}
            onChange={(e) => {
              setDraftDescription(e.target.value)
              setDescriptionError(null)
            }}
            maxLength={POOL_DESCRIPTION_MAX_LENGTH}
            rows={3}
            placeholder="Optional short description for this pool"
            className={FOCUS_VISIBLE_RING}
            aria-invalid={Boolean(descriptionError)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {draftDescription.trim().length}/{POOL_DESCRIPTION_MAX_LENGTH}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={savingDescription}
              className={FOCUS_VISIBLE_RING}
              onClick={() => void handleSaveDescription()}
            >
              {savingDescription ? 'Saving…' : 'Save description'}
            </Button>
          </div>
          {descriptionError ? (
            <p className="text-sm text-destructive" role="alert">
              {descriptionError}
            </p>
          ) : null}
        </section>
      ) : poolDescription ? (
        <section>
          <SectionHeading title="Description" />
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {poolDescription}
          </p>
        </section>
      ) : null}

      {isAdmin && poolId ? (
        <section className="rounded-2xl border border-border bg-card/50 px-4 py-4">
          <SectionHeading title="Activity summary" />
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Members
              </dt>
              <dd className="font-display text-2xl tabular-nums text-foreground">
                {members.length}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                With points
              </dt>
              <dd className="font-display text-2xl tabular-nums text-foreground">
                {members.length - missingPredictionCount}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Still at 0 pts
              </dt>
              <dd className="font-display text-2xl tabular-nums text-foreground">
                {missingPredictionCount}
              </dd>
            </div>
          </dl>
          {isAdmin ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {isOwner ? 'You are the pool owner.' : 'You are a co-commissioner.'}
            </p>
          ) : null}
        </section>
      ) : null}

      {isAdmin ? (
        <section className="min-w-0 space-y-6">
          <SectionHeading title="Pool branding" />

          <div className="space-y-3">
            <SubsectionHeading title="Pool logo" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <PoolAvatarImage
                avatar={poolAvatar}
                emblemUrl={poolEmblemUrl}
                size="md"
                className="mx-auto sm:mx-0"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {poolEmblemUrl
                    ? 'Shown in the pool header and on share cards.'
                    : 'Add a pool logo to personalize this squad.'}
                </p>
                <input
                  ref={emblemInputRef}
                  id={emblemFileInputId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={emblemBusy}
                  onChange={(event) => void handleEmblemFileChange(event)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn('h-9', FOCUS_VISIBLE_RING)}
                    disabled={emblemBusy}
                    aria-controls={emblemFileInputId}
                    onClick={() => emblemInputRef.current?.click()}
                  >
                    {emblemBusy ? (
                      <>
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden
                        />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <ImagePlus className="mr-2 h-4 w-4" aria-hidden />
                        {poolEmblemUrl ? 'Replace logo' : 'Add a pool logo'}
                      </>
                    )}
                  </Button>
                  {poolEmblemUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(
                        'h-9 text-destructive hover:text-destructive',
                        FOCUS_VISIBLE_RING,
                      )}
                      disabled={emblemBusy}
                      onClick={() => void handleRemoveEmblem()}
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                      Remove
                    </Button>
                  ) : null}
                  {emblemError ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className={cn('h-9', FOCUS_VISIBLE_RING)}
                      disabled={emblemBusy}
                      onClick={() => {
                        setEmblemError(null)
                        emblemInputRef.current?.click()
                      }}
                    >
                      Retry
                    </Button>
                  ) : null}
                </div>
                {emblemError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {emblemError}
                  </p>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  JPEG, PNG, or WebP. Images are resized automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SubsectionHeading title="Pool color" />
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border-2 border-white/25 shadow-[0_0_14px_color-mix(in_srgb,var(--primary)_35%,transparent)]"
                style={{
                  background: `linear-gradient(160deg, ${effectiveTheme} 0%, color-mix(in srgb, ${effectiveTheme} 50%, #0a0a0a) 100%)`,
                }}
                title={poolThemeColor == null ? 'Default' : effectiveTheme}
                aria-label={`Current pool color ${effectiveTheme}`}
              >
                <span
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent"
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm text-muted-foreground">
                  {effectiveTheme}
                  {poolThemeColor == null ? ' · default' : ''}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn('h-8', FOCUS_VISIBLE_RING)}
                aria-expanded={colorsExpanded}
                onClick={() => setColorsExpanded((open) => !open)}
              >
                {colorsExpanded ? 'Done' : 'Customize'}
              </Button>
            </div>

            {colorsExpanded ? (
              <div className="mt-4 space-y-3">
                <div
                  className="flex flex-wrap gap-2.5"
                  role="group"
                  aria-label="Theme color presets"
                >
                  <button
                    type="button"
                    disabled={savingTheme}
                    onClick={() => handleSaveThemeColor(null)}
                    className={cn(
                      'relative h-11 min-w-[4.5rem] overflow-hidden rounded-xl border px-3 text-xs font-semibold transition-all',
                      FOCUS_VISIBLE_RING,
                      poolThemeColor == null
                        ? 'scale-[1.03] border-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_40%,transparent)]'
                        : 'border-white/15 hover:scale-[1.03]',
                    )}
                    style={{
                      background: `linear-gradient(160deg, ${DEFAULT_POOL_THEME_COLOR} 0%, color-mix(in srgb, ${DEFAULT_POOL_THEME_COLOR} 55%, #111) 100%)`,
                    }}
                    title="Default PoolCup green"
                  >
                    <span className="relative z-10 text-[#080b0f] drop-shadow-sm">
                      Default
                    </span>
                    <span
                      className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent"
                      aria-hidden
                    />
                    {poolThemeColor == null ? (
                      <Check
                        className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-[#080b0f]"
                        aria-hidden
                      />
                    ) : null}
                  </button>

                  {POOL_THEME_COLOR_PRESETS.map((preset) => {
                    const selected =
                      normalizePoolThemeColor(poolThemeColor) === preset.hex
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={savingTheme}
                        onClick={() => handleSaveThemeColor(preset.hex)}
                        className={cn(
                          'relative h-11 w-11 overflow-hidden rounded-xl border-2 transition-all',
                          FOCUS_VISIBLE_RING,
                          selected
                            ? 'scale-[1.08] border-white shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_50%,transparent)]'
                            : 'border-white/20 hover:scale-[1.06]',
                        )}
                        style={{
                          background: `linear-gradient(160deg, ${preset.hex} 0%, color-mix(in srgb, ${preset.hex} 50%, #0a0a0a) 100%)`,
                        }}
                        aria-label={preset.label}
                        aria-pressed={selected}
                        title={preset.label}
                      >
                        <span
                          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent"
                          aria-hidden
                        />
                        {selected ? (
                          <Check
                            className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow"
                            aria-hidden
                          />
                        ) : null}
                      </button>
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
                      className={cn('h-9 font-mono text-sm', FOCUS_VISIBLE_RING)}
                      disabled={savingTheme}
                      aria-invalid={
                        themeContrast.warning != null &&
                        isValidPoolThemeHex(
                          customHex.startsWith('#')
                            ? customHex
                            : `#${customHex}`,
                        )
                      }
                      aria-describedby={
                        themeContrast.warning
                          ? 'pool-theme-contrast-warning'
                          : undefined
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn('h-9', FOCUS_VISIBLE_RING)}
                    disabled={
                      savingTheme ||
                      !isValidPoolThemeHex(
                        customHex.startsWith('#')
                          ? customHex
                          : `#${customHex}`,
                      )
                    }
                    onClick={() => handleSaveThemeColor(customHex)}
                  >
                    {savingTheme ? 'Saving…' : 'Apply'}
                  </Button>
                </div>
                {themeContrast.warning ? (
                  <p
                    id="pool-theme-contrast-warning"
                    className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
                    role="status"
                  >
                    {themeContrast.warning}
                  </p>
                ) : null}
                {themeError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {themeError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <AlertDialog
            open={contrastConfirmOpen}
            onOpenChange={setContrastConfirmOpen}
          >
            <AlertDialogContent className={FOCUS_VISIBLE_RING}>
              <AlertDialogHeader>
                <AlertDialogTitle>Low contrast color</AlertDialogTitle>
                <AlertDialogDescription>
                  This color may make text hard to read on buttons and accents.
                  Save it anyway?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className={FOCUS_VISIBLE_RING}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className={FOCUS_VISIBLE_RING}
                  onClick={() => {
                    setContrastConfirmOpen(false)
                    void persistThemeColor(pendingThemeColor)
                  }}
                >
                  Save anyway
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="space-y-8">
          <SectionHeading title="Commissioner tools" />

          {isClassicPool ? (
            <div>
              <SubsectionHeading title="Custom scoring" />
              <p className="mb-3 text-xs text-muted-foreground">
                Points for exact scores, winners, and draws in this pool.
              </p>
              {scoringLocked ? (
                <p
                  className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
                  role="status"
                >
                  Matches have started. You can still change scoring, but
                  everyone’s points will be recalculated.
                </p>
              ) : null}

              {canEditScoring ? (
                <div
                  className="space-y-3"
                  role="group"
                  aria-labelledby={`${scoringFormId}-heading`}
                >
                  <p id={`${scoringFormId}-heading`} className="sr-only">
                    Custom scoring points
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label
                        htmlFor={`${scoringFormId}-exact`}
                        className="text-xs text-muted-foreground"
                      >
                        Exact score
                      </Label>
                      <Input
                        id={`${scoringFormId}-exact`}
                        type="number"
                        min={CLASSIC_SCORE_POINTS_MIN}
                        max={CLASSIC_SCORE_POINTS_MAX}
                        step={1}
                        inputMode="numeric"
                        value={draftExact}
                        onChange={(event) => {
                          setDraftExact(event.target.value)
                          setScoringError(null)
                          setLastRecalcResult(null)
                        }}
                        placeholder={String(CLASSIC_DEFAULT_EXACT_POINTS)}
                        className={cn('h-9 tabular-nums', FOCUS_VISIBLE_RING)}
                        disabled={savingScoring}
                        aria-invalid={Boolean(scoringError)}
                        aria-describedby={
                          draftScoringPreview.ok
                            ? `${scoringFormId}-preview`
                            : undefined
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={`${scoringFormId}-winner`}
                        className="text-xs text-muted-foreground"
                      >
                        Correct winner
                      </Label>
                      <Input
                        id={`${scoringFormId}-winner`}
                        type="number"
                        min={CLASSIC_SCORE_POINTS_MIN}
                        max={CLASSIC_SCORE_POINTS_MAX}
                        step={1}
                        inputMode="numeric"
                        value={draftWinner}
                        onChange={(event) => {
                          setDraftWinner(event.target.value)
                          setScoringError(null)
                          setLastRecalcResult(null)
                        }}
                        placeholder={String(CLASSIC_DEFAULT_WINNER_POINTS)}
                        className={cn('h-9 tabular-nums', FOCUS_VISIBLE_RING)}
                        disabled={savingScoring}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={`${scoringFormId}-draw`}
                        className="text-xs text-muted-foreground"
                      >
                        Correct draw
                      </Label>
                      <Input
                        id={`${scoringFormId}-draw`}
                        type="number"
                        min={CLASSIC_SCORE_POINTS_MIN}
                        max={CLASSIC_SCORE_POINTS_MAX}
                        step={1}
                        inputMode="numeric"
                        value={draftDraw}
                        onChange={(event) => {
                          setDraftDraw(event.target.value)
                          setScoringError(null)
                          setLastRecalcResult(null)
                        }}
                        placeholder={String(CLASSIC_DEFAULT_DRAW_POINTS)}
                        className={cn('h-9 tabular-nums', FOCUS_VISIBLE_RING)}
                        disabled={savingScoring}
                      />
                    </div>
                  </div>

                  {draftScoringPreview.ok ? (
                    <div
                      id={`${scoringFormId}-preview`}
                      className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                      aria-live="polite"
                    >
                      <p>
                        With these values: exact score ={' '}
                        <span className="font-medium text-foreground">
                          {draftScoringPreview.exact} pts
                        </span>
                        , correct winner ={' '}
                        <span className="font-medium text-foreground">
                          {draftScoringPreview.winner} pts
                        </span>
                        , correct draw ={' '}
                        <span className="font-medium text-foreground">
                          {draftScoringPreview.draw} pts
                        </span>
                        .
                      </p>
                      <p className="mt-1">
                        Example: Predict 2-1, actual 2-1 →{' '}
                        {draftScoringPreview.exact} pts; predict a win, actual
                        win but wrong score → {draftScoringPreview.winner} pts.
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className={cn('h-8', FOCUS_VISIBLE_RING)}
                      disabled={savingScoring || !poolId}
                      onClick={handleSaveScoringClick}
                    >
                      {savingScoring
                        ? scoringLocked
                          ? 'Saving & recalculating…'
                          : 'Saving…'
                        : 'Save scoring'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn('h-8', FOCUS_VISIBLE_RING)}
                      disabled={savingScoring}
                      onClick={resetScoringDraftsToDefaults}
                    >
                      Reset to defaults
                    </Button>
                  </div>
                  {scoringError ? (
                    <div className="space-y-2">
                      <p className="text-sm text-destructive" role="alert">
                        {scoringError}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn('h-8', FOCUS_VISIBLE_RING)}
                        disabled={savingScoring || !poolId}
                        onClick={handleSaveScoringClick}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : null}
                  {lastRecalcResult ? (
                    <p className="text-sm text-primary" role="status">
                      {lastRecalcResult}
                    </p>
                  ) : null}
                </div>
              ) : (
                <ul className="space-y-1.5 text-sm text-foreground">
                  <li className="flex justify-between gap-3 border-b border-border/50 py-1.5">
                    <span className="text-muted-foreground">Exact score</span>
                    <span className="font-display tabular-nums text-primary">
                      {resolvedScoring.exact} pts
                    </span>
                  </li>
                  <li className="flex justify-between gap-3 border-b border-border/50 py-1.5">
                    <span className="text-muted-foreground">Correct winner</span>
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

              {poolId ? (
                <div className="mt-6">
                  <PoolScoringHistory
                    poolId={poolId}
                    refreshKey={scoringHistoryKey}
                  />
                </div>
              ) : null}

              <AlertDialog
                open={scoringConfirmOpen}
                onOpenChange={(open) => {
                  if (savingScoring) return
                  setScoringConfirmOpen(open)
                }}
              >
                <AlertDialogContent className={FOCUS_VISIBLE_RING}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Recalculate pool scoring?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Changing scoring after matches have been played will
                      recalculate everyone&apos;s points for this pool. This
                      affects the leaderboard. Are you sure?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={savingScoring}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={savingScoring}
                      className={FOCUS_VISIBLE_RING}
                      onClick={(event) => {
                        event.preventDefault()
                        void persistScoring({ confirmRecalculate: true })
                      }}
                    >
                      {savingScoring
                        ? 'Recalculating…'
                        : 'Change & recalculate'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}

          <div>
            <SubsectionHeading title="Exports" />
            {poolId ? (
              <PoolExportsSection poolId={poolId} inviteCode={inviteCode} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Pool id unavailable — exports cannot run.
              </p>
            )}
          </div>

          <div>
            <SubsectionHeading title="Announcements" />
            <p className="mb-3 text-xs text-muted-foreground">
              Post updates for the pool. Pin one to feature it in the banner.
              Members are notified when you post a new announcement.
            </p>
            {poolId ? (
              <PoolAnnouncementsPanel
                poolId={poolId}
                currentUserId={currentUserId}
                isAdmin
                showComposer
                onBannerChange={onManagedAnnouncementChange}
              />
            ) : null}
          </div>

          <div>
            <SubsectionHeading title="Polls" />
            <p className="mb-3 text-xs text-muted-foreground">
              Create polls for members to vote on. Results update live.
            </p>
            {poolId ? (
              <PoolPollsPanel poolId={poolId} isAdmin showComposer />
            ) : null}
          </div>

          <div>
            <SubsectionHeading title="Membership" />
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
            {acceptingMembers && inviteCode ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Invite link
                </p>
                <PoolInviteCard
                  inviteCode={inviteCode}
                  poolId={poolId}
                  poolName={poolName}
                  source="pool_settings"
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          {isClassicPool ? (
            <section className="space-y-6">
              <div>
                <SectionHeading title="Scoring rules" />
                <ul className="space-y-1.5 text-sm text-foreground">
                  <li className="flex justify-between gap-3 border-b border-border/50 py-1.5">
                    <span className="text-muted-foreground">Exact score</span>
                    <span className="font-display tabular-nums text-primary">
                      {resolvedScoring.exact} pts
                    </span>
                  </li>
                  <li className="flex justify-between gap-3 border-b border-border/50 py-1.5">
                    <span className="text-muted-foreground">Correct winner</span>
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
              </div>
              {poolId ? <PoolScoringHistory poolId={poolId} /> : null}
            </section>
          ) : null}
          {poolId ? (
            <section className="space-y-3">
              <SectionHeading title="Announcements" />
              <PoolAnnouncementsPanel
                poolId={poolId}
                currentUserId={currentUserId}
                isAdmin={false}
                showComposer={false}
              />
            </section>
          ) : null}
          {poolId ? (
            <section className="space-y-3">
              <SectionHeading title="Polls" />
              <PoolPollsPanel
                poolId={poolId}
                isAdmin={false}
                showComposer={false}
              />
            </section>
          ) : null}
          <p
            id="accepting-members-help"
            className="text-sm text-muted-foreground"
          >
            {acceptingMembers
              ? 'This pool is open to new members.'
              : 'This pool is closed to new members.'}
          </p>
        </>
      )}

      <section className="space-y-3">
        <SectionHeading
          title={isAdmin ? 'Manage members' : 'Members'}
          trailing={
            <p className="shrink-0 text-sm text-muted-foreground">
              {members.length} {playerLabel}
            </p>
          }
        />
        {isAdmin ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Removing a member permanently deletes their predictions and standing
            in this pool.
            {!isOwner
              ? ' Co-commissioners can only remove regular members.'
              : ''}
          </p>
        ) : null}

        {roster.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No members yet</p>
          </div>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {roster.map((member) => {
              const memberIsCreator = member.userId === poolCreatorUserId
              const memberIsCoAdmin = coAdminIdSet.has(member.userId)
              const isFirst = member.rank === 1
              const canRemove =
                isAdmin &&
                !memberIsCreator &&
                Boolean(poolId) &&
                (isOwner || !memberIsCoAdmin)

              return (
                <li
                  key={member.id}
                  className={cn(
                    'relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3',
                    memberIsCreator
                      ? 'border-[#ffb300]/45 bg-gradient-to-r from-[#ffb300]/10 to-transparent'
                      : isFirst
                        ? 'border-primary/40 bg-primary/5'
                        : member.isYou
                          ? 'border-primary/30 bg-primary/10'
                          : 'border-border/70 bg-card/70',
                  )}
                >
                  <div className="relative shrink-0">
                    <UserProfileLink
                      userId={member.userId}
                      ariaLabel={`${member.name}'s profile`}
                      className="block"
                    >
                      <UserAvatarImage
                        avatar={member.avatar}
                        customAvatarUrl={member.customAvatarUrl}
                        className={cn(
                          'h-12 w-12',
                          memberIsCreator && 'ring-2 ring-[#ffb300]/50',
                          isFirst &&
                            !memberIsCreator &&
                            'ring-2 ring-primary/40',
                        )}
                      />
                    </UserProfileLink>
                    {isFirst ? (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#ffb300] text-[#080b0f] shadow">
                        <Trophy className="h-3 w-3" aria-hidden />
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <UserProfileLink
                        userId={member.userId}
                        className={cn(
                          'truncate text-sm font-semibold hover:underline',
                          member.isYou ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {member.name}
                        {member.isYou ? ' (You)' : ''}
                      </UserProfileLink>
                      {memberIsCreator ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ffb300]">
                          <Crown className="h-3 w-3" aria-hidden />
                          Owner
                        </span>
                      ) : memberIsCoAdmin ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Co-commissioner
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-display tabular-nums text-primary">
                        #{member.rank}
                      </span>
                      <span className="mx-1.5 text-border">·</span>
                      <span className="tabular-nums">{member.points} pts</span>
                    </p>
                  </div>

                  {canRemove ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          aria-label={`Actions for ${member.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onSelect={() => setMemberPendingRemove(member)}
                        >
                          <UserMinus className="h-3.5 w-3.5" aria-hidden />
                          Remove member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {isAdmin && poolId ? (
        <div className="space-y-8">
          {isOwner && poolCreatorUserId ? (
            <CommissionerCoAdminsSection
              poolId={poolId}
              ownerUserId={poolCreatorUserId}
              members={members}
              initialCoAdmins={coAdminUserIds.map((userId) => ({
                userId,
                displayName:
                  members.find((m) => m.userId === userId)?.name ?? null,
                username: null,
              }))}
            />
          ) : null}
          <CommissionerMissingPredictions
            poolId={poolId}
            inviteCode={inviteCode}
            poolName={poolName}
          />
          <CommissionerModerationLog poolId={poolId} />
        </div>
      ) : null}

      {poolId ? (
        <section className="space-y-4">
          <SubsectionHeading title="Your membership" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isOwner
              ? 'As owner you can transfer ownership to another member, or leave after transferring. Delete only if you want the pool gone for everyone.'
              : isAdmin
                ? 'As co-commissioner you can manage settings and members. Only the owner can transfer or delete the pool.'
                : 'Leave this pool to remove yourself and your predictions here.'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {isOwner ? (
              <Button
                type="button"
                variant="outline"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => setTransferOpen(true)}
              >
                <Crown className="mr-2 h-4 w-4" aria-hidden />
                Transfer ownership
              </Button>
            ) : null}
            <LeavePoolDialog
              poolId={poolId}
              poolName={poolName}
              currentUserId={currentUserId}
              isCreator={isOwner}
              members={members}
              onOwnershipTransferred={(newOwnerUserId) => {
                capturePostHog('ownership_transferred', { pool_id: poolId })
                onOwnershipTransferred?.(newOwnerUserId)
              }}
            />
          </div>

          {isOwner ? (
            <div className="pt-2">
              <SubsectionHeading title="Danger Zone" tone="danger" />
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                Permanently deletes the pool, all members, and every prediction.
                Prefer closing to new members or transferring ownership instead.
              </p>
              <DeletePoolDialog
                poolId={poolId}
                poolName={poolName}
                redirectTo="/dashboard"
                triggerVariant="outline"
                triggerClassName="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onDeleted={() => {
                  capturePostHog('pool_deleted', { pool_id: poolId })
                  capturePostHog('commissioner_action', {
                    action: 'pool_deleted',
                    pool_id: poolId,
                  })
                }}
              />
            </div>
          ) : null}

          {isOwner ? (
            <TransferOwnershipDialog
              open={transferOpen}
              onOpenChange={setTransferOpen}
              poolId={poolId}
              poolName={poolName}
              currentUserId={currentUserId}
              members={members}
              onTransferred={(newOwnerUserId) => {
                capturePostHog('ownership_transferred', { pool_id: poolId })
                capturePostHog('commissioner_action', {
                  action: 'ownership_transferred',
                  pool_id: poolId,
                })
                onOwnershipTransferred?.(newOwnerUserId)
              }}
            />
          ) : null}
        </section>
      ) : null}

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
                  This permanently removes them from the pool and deletes all of
                  their predictions, group picks, and leaderboard standing for
                  this pool. This cannot be undone.
                </p>
                <p>
                  They can rejoin later if the pool is still open to new members
                  — but their old predictions will not come back.
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
