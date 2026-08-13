'use client'

import { useEffect, useState } from 'react'
import {
  Check,
  Crown,
  Loader2,
  Lock,
  Megaphone,
  MoreHorizontal,
  Pencil,
  UserMinus,
  Users,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { CommissionerCoAdminsSection } from '@/components/pool/commissioner-co-admins-section'
import { CommissionerMissingPredictions } from '@/components/pool/commissioner-missing-predictions'
import { CommissionerModerationLog } from '@/components/pool/commissioner-moderation-log'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'
import { LeavePoolDialog } from '@/components/pool/leave-pool-dialog'
import { PoolInviteCard } from '@/components/pool/pool-invite-card'
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
  ANNOUNCEMENT_MAX_LENGTH,
  clearPoolAnnouncement,
  getLatestActiveAnnouncement,
  postPoolAnnouncement,
  type PoolAnnouncement,
} from '@/src/lib/pool-announcements'
import { patchPoolSettings } from '@/src/lib/pool-settings-client'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

type PoolSettingsTabProps = {
  poolId?: string
  poolName: string
  poolDescription?: string | null
  inviteCode?: string
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
  /** Owner or co-commissioner (server-verified when possible). */
  isAdmin?: boolean
  /** Pool owner (creator_id). */
  isOwner?: boolean
  /** userIds currently in pool_admins (co-commissioners). */
  coAdminUserIds?: string[]
  onPoolNameChange?: (name: string) => void
  onPoolDescriptionChange?: (description: string | null) => void
  onPoolThemeColorChange?: (themeColor: string | null) => void
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

function AnnouncementPreviewBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className={cn(
        'relative overflow-hidden rounded-xl border border-primary/35',
        'bg-gradient-to-r from-primary/15 via-primary/10 to-transparent',
        'px-3 py-3 sm:px-4',
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary"
        aria-hidden
      />
      <div className="flex items-start gap-3 pl-1.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
          <Megaphone className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {message}
        </p>
      </div>
    </div>
  )
}

export function PoolSettingsTab({
  poolId,
  poolName,
  poolDescription = null,
  inviteCode,
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
  isAdmin: isAdminProp,
  isOwner: isOwnerProp,
  coAdminUserIds = [],
  onPoolNameChange,
  onPoolDescriptionChange,
  onPoolThemeColorChange,
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
  const [colorsExpanded, setColorsExpanded] = useState(false)

  const isClassicPool = scoringStyle !== 'winner'
  const canEditScoring = isAdmin && isClassicPool && !scoringLocked

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

  useEffect(() => {
    if (!isAdmin || !poolId) {
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
  }, [isAdmin, poolId])

  const validationError = validatePoolName(draftName)
  const canSave =
    Boolean(poolId) &&
    !validationError &&
    !isPoolNameUnchanged(poolName, draftName) &&
    !saving

  const effectiveTheme = resolvePoolThemeColor(poolThemeColor)
  const liveAnnouncementPreview =
    draftAnnouncement.trim() || managedAnnouncement?.message || ''

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

  async function handleSaveThemeColor(next: string | null) {
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
    toast.success(normalized ? 'Pool color saved' : 'Pool color reset to default')
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

    const result = await patchPoolSettings(poolId, {
      scoreExactPoints: nextExact,
      scoreWinnerPoints: nextWinner,
      scoreDrawPoints: nextDraw,
    })
    setSavingScoring(false)

    if (!result.success) {
      setScoringError(result.error || 'Failed to save scoring rules')
      toast.error('Could not save scoring rules')
      return
    }

    onPoolScoringChange?.({
      scoreExactPoints: result.pool?.scoreExactPoints ?? nextExact,
      scoreWinnerPoints: result.pool?.scoreWinnerPoints ?? nextWinner,
      scoreDrawPoints: result.pool?.scoreDrawPoints ?? nextDraw,
    })
    capturePostHog('commissioner_action', {
      action: 'scoring_edited',
      pool_id: poolId,
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

  async function handlePostAnnouncement() {
    if (!poolId || !isAdmin || postingAnnouncement) return
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
      void fetch('/api/notifications/notify-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId,
          announcementId: result.announcement.id,
          message: result.announcement.message,
        }),
      }).catch(() => {})
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
        <section>
          <SectionHeading title="Pool color" />
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
              className="h-8"
              aria-expanded={colorsExpanded}
              onClick={() => setColorsExpanded((open) => !open)}
            >
              {colorsExpanded ? 'Done' : 'Customize'}
            </Button>
          </div>

          {colorsExpanded ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={savingTheme}
                  onClick={() => void handleSaveThemeColor(null)}
                  className={cn(
                    'relative h-11 min-w-[4.5rem] overflow-hidden rounded-xl border px-3 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
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
                      onClick={() => void handleSaveThemeColor(preset.hex)}
                      className={cn(
                        'relative h-11 w-11 overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
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
                <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Scoring is locked because matches have started.
                </p>
              ) : null}

              {canEditScoring ? (
                <div className="space-y-3">
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
            </div>
          ) : null}

          <div>
            <SubsectionHeading title="Announcements" />
            <p className="mb-3 text-xs text-muted-foreground">
              Members see this as a banner at the top of the pool until they
              dismiss it.
            </p>
            <div className="space-y-3">
              {loadingAnnouncement ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : liveAnnouncementPreview ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {draftAnnouncement.trim()
                      ? 'Live preview'
                      : 'Active announcement'}
                  </p>
                  <AnnouncementPreviewBanner
                    message={liveAnnouncementPreview}
                  />
                  {managedAnnouncement && !draftAnnouncement.trim() ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8"
                      disabled={clearingAnnouncement || postingAnnouncement}
                      onClick={() => void handleClearAnnouncement()}
                    >
                      {clearingAnnouncement
                        ? 'Clearing…'
                        : 'Clear announcement'}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No active announcement — start typing to preview.
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs tabular-nums text-muted-foreground">
                  {draftAnnouncement.trim().length}/{ANNOUNCEMENT_MAX_LENGTH}
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="h-11 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto sm:min-w-[12rem]"
                  disabled={
                    postingAnnouncement ||
                    !poolId ||
                    draftAnnouncement.trim().length === 0
                  }
                  onClick={() => void handlePostAnnouncement()}
                >
                  {postingAnnouncement ? 'Posting…' : 'Post Announcement'}
                </Button>
              </div>
              {announcementError ? (
                <p className="text-xs text-destructive" role="alert">
                  {announcementError}
                </p>
              ) : null}
            </div>
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
            <section>
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
