'use client'

import { BracketVisualTree } from '@/components/pool/bracket-visual-tree'
import type { GroupRankings, WorldCupGroup, WorldCupGroupLetter } from '@/src/lib/world-cup-groups'

interface PoolBracketTabProps {
  groups: WorldCupGroup[]
  groupRankings: GroupRankings
  thirdPlaceRankings: string[]
  readOnly: boolean
  onTeamTap: (groupLetter: WorldCupGroupLetter, teamName: string) => void
  onThirdPlaceTeamTap: (teamName: string) => void
}

export function PoolBracketTab({
  groups,
  groupRankings,
  thirdPlaceRankings,
  readOnly,
  onTeamTap,
  onThirdPlaceTeamTap,
}: PoolBracketTabProps) {
  return (
    <BracketVisualTree
      groups={groups}
      groupRankings={groupRankings}
      thirdPlaceRankings={thirdPlaceRankings}
      readOnly={readOnly}
      onTeamTap={onTeamTap}
      onThirdPlaceTeamTap={onThirdPlaceTeamTap}
    />
  )
}
