'use client'

import { BracketVisualTree } from '@/components/pool/bracket-visual-tree'
import type { GroupRankings, WorldCupGroup, WorldCupGroupLetter } from '@/src/lib/world-cup-groups'

interface PoolBracketTabProps {
  groups: WorldCupGroup[]
  groupRankings: GroupRankings
  thirdPlaceRankings: string[]
  isGroupLocked: (groupLetter: WorldCupGroupLetter) => boolean
  isThirdPlaceLocked?: boolean
  thirdPlaceLockKickoffAtMs?: number
  onTeamTap: (groupLetter: WorldCupGroupLetter, teamName: string) => void
  onThirdPlaceTeamTap: (teamName: string) => void
}

export function PoolBracketTab({
  groups,
  groupRankings,
  thirdPlaceRankings,
  isGroupLocked,
  isThirdPlaceLocked = false,
  thirdPlaceLockKickoffAtMs,
  onTeamTap,
  onThirdPlaceTeamTap,
}: PoolBracketTabProps) {
  return (
    <BracketVisualTree
      groups={groups}
      groupRankings={groupRankings}
      thirdPlaceRankings={thirdPlaceRankings}
      isGroupLocked={isGroupLocked}
      isThirdPlaceLocked={isThirdPlaceLocked}
      thirdPlaceLockKickoffAtMs={thirdPlaceLockKickoffAtMs}
      onTeamTap={onTeamTap}
      onThirdPlaceTeamTap={onThirdPlaceTeamTap}
    />
  )
}
