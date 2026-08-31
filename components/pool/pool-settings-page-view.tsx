'use client'

import { toast } from 'sonner'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { PoolLeaderboardDesktopSidebar } from '@/components/pool/pool-leaderboard-desktop-sidebar'
import { PoolDesktopTopBar } from '@/components/pool/pool-desktop-top-bar'
import { PoolSettingsDesktopShell } from '@/components/pool/pool-settings-desktop-shell'
import { PoolThemeScope } from '@/components/pool/pool-theme-scope'
import { trackEvent } from '@/src/lib/track'
import { capturePostHog } from '@/src/lib/posthog-client'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { shareOrCopy } from '@/src/lib/share-client'
import type { PoolSettingsPageData } from '@/src/lib/pool-settings-page-data'
import {
  normalizePoolSettingsControlId,
  normalizePoolSettingsSection,
  poolPagePath,
  poolSettingsPath,
  poolUpgradePath,
  shallowPoolSettingsUrl,
  shouldUsePoolSettingsMobileTab,
} from '@/src/lib/pool-settings-nav'
import { cn } from '@/lib/utils'
import {
  POOL_DESKTOP_CANVAS_CLASS,
} from '@/src/lib/dashboard-surfaces'

type PoolSettingsPageViewProps = {
  initial: PoolSettingsPageData
  section: string | null
}

export function PoolSettingsPageView({
  initial,
  section: sectionParam,
}: PoolSettingsPageViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const leavingGuardRef = useRef<(() => boolean) | null>(null)

  const [poolName, setPoolName] = useState(initial.poolName)
  const [poolDescription, setPoolDescription] = useState(
    initial.poolDescription,
  )
  const [poolThemeColor, setPoolThemeColor] = useState(initial.poolThemeColor)
  const [poolEmblemUrl, setPoolEmblemUrl] = useState(initial.poolEmblemUrl)
  const [scoreExactPoints, setScoreExactPoints] = useState(
    initial.scoreExactPoints,
  )
  const [scoreWinnerPoints, setScoreWinnerPoints] = useState(
    initial.scoreWinnerPoints,
  )
  const [scoreDrawPoints, setScoreDrawPoints] = useState(
    initial.scoreDrawPoints,
  )
  const [acceptingMembers, setAcceptingMembers] = useState(
    initial.acceptingMembers,
  )
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [members, setMembers] = useState(initial.members)
  const [poolCreatorUserId, setPoolCreatorUserId] = useState(
    initial.poolCreatorUserId,
  )

  useEffect(() => {
    if (!shouldUsePoolSettingsMobileTab()) return
    const params = new URLSearchParams({ tab: 'settings' })
    const normalized = normalizePoolSettingsSection(sectionParam)
    if (normalized) params.set('section', normalized)
    if (searchParams.get('upgraded') === '1') params.set('upgraded', '1')
    router.replace(`${poolPagePath(initial.inviteCode)}?${params.toString()}`)
  }, [initial.inviteCode, router, sectionParam, searchParams])

  useEffect(() => {
    if (searchParams.get('upgraded') !== '1') return
    toast.success(
      'Custom Pool unlocked — logo, colors, and commissioner tools are ready.',
    )
    const next = new URLSearchParams(searchParams.toString())
    next.delete('upgraded')
    const qs = next.toString()
    const url = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname
    shallowPoolSettingsUrl(url, 'replace')
  }, [searchParams])

  const copyInviteLink = () => {
    if (!acceptingMembers) return
    const joinUrl = buildJoinInviteUrl(
      window.location.origin,
      initial.inviteCode,
      initial.currentUserId,
    )
    capturePostHog('share_card_generated', { type: 'pool_invite' })
    void shareOrCopy({
      title: `Join ${poolName} on PoolCup`,
      text: 'Join my prediction pool on PoolCup',
      url: joinUrl,
      imageUrl: `/api/share/pool/${encodeURIComponent(initial.inviteCode)}`,
      type: 'pool_invite',
    })
      .then(() => {
        trackEvent('invite_link_copied', {
          poolId: initial.poolId ?? null,
          metadata: { source: 'pool_settings_page' },
        })
        if (initial.poolId) {
          capturePostHog('invite_link_copied', { pool_id: initial.poolId })
        }
      })
      .catch(() => {
        /* abort / ignore */
      })
  }

  const creatorDisplayName = (() => {
    const fromMember = members.find(
      (member) =>
        Boolean(member.userId) &&
        member.userId === initial.poolCreatorUserId,
    )?.name?.trim()
    return fromMember || null
  })()

  const tabProps = {
    poolId: initial.poolId,
    poolName,
    poolDescription,
    inviteCode: initial.inviteCode,
    poolThemeColor,
    poolAvatar: initial.poolAvatar,
    poolEmblemUrl,
    scoringStyle: initial.scoringStyle,
    scoreExactPoints,
    scoreWinnerPoints,
    scoreDrawPoints,
    scoringLocked: initial.scoringLocked,
    acceptingMembers,
    isPublic,
    members,
    poolCreatorUserId,
    currentUserId: initial.currentUserId,
    isOwner: initial.isOwner,
    isAdmin: initial.isAdmin,
    poolHasCommissionerTools: initial.poolHasCommissionerTools,
    coAdminUserIds: initial.coAdminUserIds,
    onPoolNameChange: setPoolName,
    onPoolDescriptionChange: setPoolDescription,
    onPoolThemeColorChange: setPoolThemeColor,
    onPoolEmblemUrlChange: setPoolEmblemUrl,
    onPoolScoringChange: (scoring: {
      scoreExactPoints: number | null
      scoreWinnerPoints: number | null
      scoreDrawPoints: number | null
    }) => {
      setScoreExactPoints(scoring.scoreExactPoints)
      setScoreWinnerPoints(scoring.scoreWinnerPoints)
      setScoreDrawPoints(scoring.scoreDrawPoints)
    },
    onAcceptingMembersChange: setAcceptingMembers,
    onIsPublicChange: setIsPublic,
    onMemberRemoved: (memberId: string) => {
      setMembers((previous) =>
        previous.filter((member) => member.id !== memberId),
      )
    },
    onOwnershipTransferred: setPoolCreatorUserId,
    onRegisterLeavingGuard: (guard: (() => boolean) | null) => {
      leavingGuardRef.current = guard
    },
    onNavigateUpgrade: () => {
      router.push(poolUpgradePath(initial.inviteCode))
    },
  }

  return (
    <PoolThemeScope
      themeColor={poolThemeColor}
      className={cn('w-full min-w-0 min-h-screen', POOL_DESKTOP_CANVAS_CLASS)}
    >
      <div className={cn('flex min-h-screen flex-col', POOL_DESKTOP_CANVAS_CLASS)}>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch">
          <PoolLeaderboardDesktopSidebar
            pool={{
              name: poolName,
              scoringStyle: initial.scoringStyle,
              memberCount: members.length,
              isPublic,
              avatar: initial.poolAvatar,
              emblemUrl: poolEmblemUrl,
              createdAt: initial.createdAt,
            }}
            creatorName={creatorDisplayName}
            canInvite={acceptingMembers}
            onInvite={copyInviteLink}
            members={members}
            poolId={initial.poolId}
            poolNavMode="links"
            inviteCode={initial.inviteCode}
            activePoolNav="settings"
            poolHasCommissionerTools={initial.poolHasCommissionerTools}
            onPoolNavNavigate={(href) => {
              router.push(href)
            }}
            onNavigateUpgrade={() => {
              router.push(poolUpgradePath(initial.inviteCode))
            }}
          />

          <main
            className={cn(
              'flex min-h-0 min-w-0 flex-1 shrink basis-0 flex-col',
              'lg:min-h-screen',
              POOL_DESKTOP_CANVAS_CLASS,
            )}
          >
            <PoolDesktopTopBar
              context="settings"
              poolName={poolName}
              scoringStyle={initial.scoringStyle}
              memberCount={members.length}
              isPublic={isPublic}
              avatar={initial.poolAvatar}
              emblemUrl={poolEmblemUrl}
              canInvite={acceptingMembers}
              onInvite={copyInviteLink}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <PoolSettingsDesktopShell
                inviteCode={initial.inviteCode}
                sectionParam={sectionParam}
                subParam={normalizePoolSettingsControlId(searchParams.get('sub'))}
                tabProps={tabProps}
              />
            </div>
          </main>
        </div>
      </div>
    </PoolThemeScope>
  )
}
