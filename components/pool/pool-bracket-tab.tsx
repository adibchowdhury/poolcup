'use client'

import { BracketVisualTree } from '@/components/pool/bracket-visual-tree'
import type { GroupRankings, WorldCupGroup, WorldCupGroupLetter } from '@/src/lib/world-cup-groups'

interface PoolBracketTabProps {
  groups: WorldCupGroup[]
  groupRankings: GroupRankings
  readOnly: boolean
  onTeamTap: (groupLetter: WorldCupGroupLetter, teamName: string) => void
}

export function PoolBracketTab({
  groups,
  groupRankings,
  readOnly,
  onTeamTap,
}: PoolBracketTabProps) {
  return (
    <BracketVisualTree
      groups={groups}
      groupRankings={groupRankings}
      readOnly={readOnly}
      onTeamTap={onTeamTap}
    />
  )
}
