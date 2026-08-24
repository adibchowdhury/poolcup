'use client'

import { toast } from 'sonner'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { PoolSettingsHub } from '@/components/pool/pool-settings-hub'
import { PoolThemeScope } from '@/components/pool/pool-theme-scope'
import type { PoolSettingsPageData } from '@/src/lib/pool-settings-page-data'

type PoolSettingsPageViewProps = {
  initial: PoolSettingsPageData
  section: string | null
}

export function PoolSettingsPageView({
  initial,
  section,
}: PoolSettingsPageViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('upgraded') !== '1') return
    toast.success('Custom Pool unlocked — logo, colors, and commissioner tools are ready.')
    const next = new URLSearchParams(searchParams.toString())
    next.delete('upgraded')
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname)
  }, [searchParams, router])

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

  return (
    <PoolThemeScope themeColor={poolThemeColor} className="w-full min-w-0">
      <PoolSettingsHub
        inviteCode={initial.inviteCode}
        section={section}
        poolId={initial.poolId}
        poolName={poolName}
        poolDescription={poolDescription}
        poolThemeColor={poolThemeColor}
        poolAvatar={initial.poolAvatar}
        poolEmblemUrl={poolEmblemUrl}
        scoringStyle={initial.scoringStyle}
        scoreExactPoints={scoreExactPoints}
        scoreWinnerPoints={scoreWinnerPoints}
        scoreDrawPoints={scoreDrawPoints}
        scoringLocked={initial.scoringLocked}
        acceptingMembers={acceptingMembers}
        isPublic={isPublic}
        members={members}
        poolCreatorUserId={poolCreatorUserId}
        currentUserId={initial.currentUserId}
        isOwner={initial.isOwner}
        isAdmin={initial.isAdmin}
        poolHasCommissionerTools={initial.poolHasCommissionerTools}
        coAdminUserIds={initial.coAdminUserIds}
        onPoolNameChange={setPoolName}
        onPoolDescriptionChange={setPoolDescription}
        onPoolThemeColorChange={setPoolThemeColor}
        onPoolEmblemUrlChange={setPoolEmblemUrl}
        onPoolScoringChange={(scoring) => {
          setScoreExactPoints(scoring.scoreExactPoints)
          setScoreWinnerPoints(scoring.scoreWinnerPoints)
          setScoreDrawPoints(scoring.scoreDrawPoints)
        }}
        onAcceptingMembersChange={setAcceptingMembers}
        onIsPublicChange={setIsPublic}
        onMemberRemoved={(memberId) => {
          setMembers((previous) =>
            previous.filter((member) => member.id !== memberId),
          )
        }}
        onOwnershipTransferred={setPoolCreatorUserId}
      />
    </PoolThemeScope>
  )
}
