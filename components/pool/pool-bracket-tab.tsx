'use client'

import { useEffect, useMemo, useState } from 'react'
import { BracketVisualTree } from '@/components/pool/bracket-visual-tree'
import { supabase } from '@/src/lib/supabase'
import {
  WORLD_CUP_GROUP_LETTERS,
  buildTeamToGroupMap,
  buildWorldCupGroups,
  type GroupStageMatch,
  type WorldCupGroup,
  type WorldCupGroupLetter,
} from '@/src/lib/world-cup-groups'
import { WC2026_DEFAULT_GROUPS } from '@/src/lib/world-cup-2026-bracket'

function mergeWithDefaultGroups(groups: WorldCupGroup[]): WorldCupGroup[] {
  return WORLD_CUP_GROUP_LETTERS.map((letter) => {
    const loaded = groups.find((group) => group.letter === letter)
    const teams =
      loaded && loaded.teams.length >= 4
        ? loaded.teams
        : WC2026_DEFAULT_GROUPS[letter as WorldCupGroupLetter]

    return { letter, teams: [...teams] }
  })
}

export function PoolBracketTab() {
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [matches, setMatches] = useState<GroupStageMatch[]>([])
  const [teamToGroup, setTeamToGroup] = useState<
    Map<string, WorldCupGroupLetter>
  >(new Map())

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setMatchesLoading(true)

      const [matchesResult, teamGroupResult] = await Promise.all([
        supabase
          .from('matches')
          .select('round, group_name, team1_name, team2_name')
          .eq('round', 'group'),
        fetch('/api/team-group-map'),
      ])

      if (cancelled) return

      if (matchesResult.error) {
        console.error(
          '[Bracket] Failed to load matches:',
          matchesResult.error.message,
        )
      } else {
        setMatches(matchesResult.data ?? [])
      }

      if (teamGroupResult.ok) {
        const payload = (await teamGroupResult.json()) as {
          standings?: Array<{ team: { name: string }; group: string }>
        }
        if (payload.standings) {
          setTeamToGroup(buildTeamToGroupMap(payload.standings))
        }
      } else {
        console.warn('[Bracket] Could not load team-group map')
      }

      setMatchesLoading(false)
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(() => {
    const built = buildWorldCupGroups(matches, teamToGroup)
    return mergeWithDefaultGroups(built)
  }, [matches, teamToGroup])

  if (matchesLoading) {
    return (
      <div className="px-4 py-12 text-center text-sm text-[#64748b]">
        Loading bracket…
      </div>
    )
  }

  return <BracketVisualTree groups={groups} />
}
