'use client'

import { BracketVisualTree } from '@/components/pool/bracket-visual-tree'
import type { GroupRankings, WorldCupGroup, WorldCupGroupLetter } from '@/src/lib/world-cup-groups'

interface PoolBracketTabProps {
  groups: WorldCupGroup[]
  groupRankings: GroupRankings
  thirdPlaceRankings: string[]
  isGroupLocked: (groupLetter: WorldCupGroupLetter) => boolean
  onTeamTap: (groupLetter: WorldCupGroupLetter, teamName: string) => void
  onThirdPlaceTeamTap: (teamName: string) => void
}

export function PoolBracketTab({
  groups,
  groupRankings,
  thirdPlaceRankings,
  isGroupLocked,
  onTeamTap,
  onThirdPlaceTeamTap,
}: PoolBracketTabProps) {
  return (
    <BracketVisualTree
      groups={groups}
      groupRankings={groupRankings}
      thirdPlaceRankings={thirdPlaceRankings}
      isGroupLocked={isGroupLocked}
      onTeamTap={onTeamTap}
      onThirdPlaceTeamTap={onThirdPlaceTeamTap}
    />
  )
}
