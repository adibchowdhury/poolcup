'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { PoolLeaderboardDesktopSidebar } from '@/components/pool/pool-leaderboard-desktop-sidebar'
import { PoolUpgradeDesktopView } from '@/components/pool/pool-upgrade-desktop-view'
import { PoolThemeScope } from '@/components/pool/pool-theme-scope'
import type { PoolSettingsPageData } from '@/src/lib/pool-settings-page-data'
import { buildJoinInviteUrl } from '@/src/lib/referral'
import { shareOrCopy } from '@/src/lib/share-client'
import { capturePostHog } from '@/src/lib/posthog-client'
import { trackEvent } from '@/src/lib/track'
import {
  poolSettingsPath,
  poolUpgradeMobileQueryPath,
  shouldUsePoolSettingsMobileTab,
} from '@/src/lib/pool-settings-nav'
import { cn } from '@/lib/utils'
import { POOL_DESKTOP_CANVAS_CLASS } from '@/src/lib/dashboard-surfaces'

type PoolUpgradePageViewProps = {
  initial: PoolSettingsPageData
}

export function PoolUpgradePageView({ initial }: PoolUpgradePageViewProps) {
  const router = useRouter()

  useEffect(() => {
    if (!shouldUsePoolSettingsMobileTab()) return
    router.replace(poolUpgradeMobileQueryPath(initial.inviteCode, 'settings'))
  }, [initial.inviteCode, router])

  const creatorDisplayName = (() => {
    const fromMember = initial.members.find(
      (member) =>
        Boolean(member.userId) &&
        member.userId === initial.poolCreatorUserId,
    )?.name?.trim()
    return fromMember || null
  })()

  function backToSettings() {
    router.push(poolSettingsPath(initial.inviteCode, 'details'))
  }

  const copyInviteLink = () => {
    if (!initial.acceptingMembers) return
    const joinUrl = buildJoinInviteUrl(
      window.location.origin,
      initial.inviteCode,
      initial.currentUserId,
    )
    capturePostHog('share_card_generated', { type: 'pool_invite' })
    void shareOrCopy({
      title: `Join ${initial.poolName} on PoolCup`,
      text: 'Join my prediction pool on PoolCup',
      url: joinUrl,
      imageUrl: `/api/share/pool/${encodeURIComponent(initial.inviteCode)}`,
      type: 'pool_invite',
    }).then(() => {
      trackEvent('invite_link_copied', {
        poolId: initial.poolId ?? null,
        metadata: { source: 'pool_upgrade_page' },
      })
      if (initial.poolId) {
        capturePostHog('invite_link_copied', { pool_id: initial.poolId })
      }
    })
  }

  return (
    <PoolThemeScope
      themeColor={initial.poolThemeColor}
      className={cn('w-full min-w-0 min-h-screen', POOL_DESKTOP_CANVAS_CLASS)}
    >
      <div className={cn('flex min-h-screen flex-col', POOL_DESKTOP_CANVAS_CLASS)}>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch">
          <PoolLeaderboardDesktopSidebar
            pool={{
              name: initial.poolName,
              scoringStyle: initial.scoringStyle,
              memberCount: initial.members.length,
              isPublic: initial.isPublic,
              avatar: initial.poolAvatar,
              emblemUrl: initial.poolEmblemUrl,
              createdAt: initial.createdAt,
            }}
            creatorName={creatorDisplayName}
            canInvite={initial.acceptingMembers}
            onInvite={copyInviteLink}
            members={initial.members}
            poolId={initial.poolId}
            poolNavMode="links"
            inviteCode={initial.inviteCode}
            activePoolNav="settings"
            poolHasCommissionerTools={initial.poolHasCommissionerTools}
            onPoolNavNavigate={(href) => router.push(href)}
            onNavigateUpgrade={() => {
              router.push(`/pool/${encodeURIComponent(initial.inviteCode)}/upgrade`)
            }}
          />

          <main
            className={cn(
              'flex min-h-0 min-w-0 flex-1 shrink basis-0 flex-col',
              'lg:min-h-screen',
              POOL_DESKTOP_CANVAS_CLASS,
            )}
          >
            <PoolUpgradeDesktopView
              inviteCode={initial.inviteCode}
              poolId={initial.poolId}
              poolName={initial.poolName}
              isOwner={initial.isOwner}
              poolHasCommissionerTools={initial.poolHasCommissionerTools}
              onBackToSettings={backToSettings}
              className="min-h-0 flex-1"
            />
          </main>
        </div>
      </div>
    </PoolThemeScope>
  )
}
