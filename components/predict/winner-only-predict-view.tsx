'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { GroupStandingCard } from '@/components/predict/group-standing-card'
import { ProgressHeader } from '@/components/predict/progress-header'
import { SaveBar } from '@/components/predict/save-bar'
import {
  WinnerOnlyRoundTabs,
  WINNER_ONLY_LOCKED_ROUND_MESSAGE,
  isWinnerOnlyLockedRoundTab,
  type WinnerOnlyRoundTabId,
} from '@/components/predict/winner-only-round-tabs'
import { supabase } from '@/src/lib/supabase'
import {
  WORLD_CUP_GROUP_LETTERS,
  buildWorldCupGroups,
  cloneGroupRankings,
  countCompleteGroups,
  emptyGroupRankings,
  parseStandingsJson,
  rankingsEqual,
  tapTeamInGroup,
  type GroupRankings,
  type GroupStageMatch,
  type WorldCupGroupLetter,
} from '@/src/lib/world-cup-groups'

type Pool = {
  id: string
  name: string
  invite_code: string
}

type GroupPredictionRow = {
  group_name: string
  standings: unknown
}

interface WinnerOnlyPredictViewProps {
  pool: Pool
  memberId: string
  inviteCode: string
}

export function WinnerOnlyPredictView({
  pool,
  memberId,
  inviteCode,
}: WinnerOnlyPredictViewProps) {
  const [activeTab, setActiveTab] = useState<WinnerOnlyRoundTabId>('r32')
  const [groupRankings, setGroupRankings] = useState<GroupRankings>(
    emptyGroupRankings(),
  )
  const [baselineRankings, setBaselineRankings] = useState<GroupRankings>(
    emptyGroupRankings(),
  )
  const [predictionsLoaded, setPredictionsLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [matches, setMatches] = useState<GroupStageMatch[]>([])
  const [teamToGroup, setTeamToGroup] = useState<
    Map<string, WorldCupGroupLetter>
  >(new Map())
  const [matchesLoading, setMatchesLoading] = useState(true)

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true)

    const [matchesResult, teamGroupResult] = await Promise.all([
      supabase
        .from('matches')
        .select('round, group_name, team1_name, team2_name')
        .eq('round', 'group')
        .order('kickoff_at', { ascending: true }),
      fetch('/api/team-group-map'),
    ])

    const { data, error: matchesError } = matchesResult

    if (matchesError) {
      console.error('[WinnerOnly] Failed to load matches:', matchesError.message)
      setError('Failed to load matches')
      setMatches([])
      setTeamToGroup(new Map())
      setMatchesLoading(false)
      return
    }

    const rows = (data ?? []) as GroupStageMatch[]

    let teamGroupMap = new Map<string, WorldCupGroupLetter>()
    if (teamGroupResult.ok) {
      const body = (await teamGroupResult.json()) as {
        teamToGroup?: Record<string, WorldCupGroupLetter>
      }
      teamGroupMap = new Map(Object.entries(body.teamToGroup ?? {}))
    } else {
      console.warn(
        '[WinnerOnly] Could not load team-group map:',
        teamGroupResult.status,
      )
    }

    setTeamToGroup(teamGroupMap)
    setMatches(rows)
    setMatchesLoading(false)
  }, [])

  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  const groups = useMemo(() => {
    return buildWorldCupGroups(
      matches,
      teamToGroup.size > 0 ? teamToGroup : undefined,
    )
  }, [matches, teamToGroup])

  const lockedRoundTab = isWinnerOnlyLockedRoundTab(activeTab)

  const loadGroupPredictions = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('group_predictions')
      .select('group_name, standings')
      .eq('pool_id', pool.id)
      .eq('member_id', memberId)

    if (loadError) {
      console.error('Failed to load group predictions:', loadError.message)
      setError('Failed to load saved group predictions')
      setPredictionsLoaded(true)
      return
    }

    const initial = emptyGroupRankings()
    for (const row of (data ?? []) as GroupPredictionRow[]) {
      const letter = row.group_name.toUpperCase()
      if (WORLD_CUP_GROUP_LETTERS.includes(letter as (typeof WORLD_CUP_GROUP_LETTERS)[number])) {
        initial[letter] = parseStandingsJson(row.standings)
      }
    }

    setGroupRankings(initial)
    setBaselineRankings(cloneGroupRankings(initial))
    setPredictionsLoaded(true)
  }, [memberId, pool.id])

  useEffect(() => {
    loadGroupPredictions()
  }, [loadGroupPredictions])

  const predictedGroupCount = useMemo(
    () => countCompleteGroups(groupRankings, groups),
    [groupRankings, groups],
  )

  const unsavedGroupCount = useMemo(() => {
    return groups.filter((group) => {
      const current = groupRankings[group.letter] ?? []
      const baseline = baselineRankings[group.letter] ?? []
      if (current.length === 0) return false
      return !rankingsEqual(current, baseline)
    }).length
  }, [baselineRankings, groupRankings, groups])

  function handleTeamTap(groupLetter: string, teamName: string) {
    const group = groups.find((g) => g.letter === groupLetter)
    if (!group) return

    setSaveSuccess(false)
    setSuccessMessage(null)
    setGroupRankings((prev) => ({
      ...prev,
      [groupLetter]: tapTeamInGroup(
        prev[groupLetter] ?? [],
        teamName,
        group.teams,
      ),
    }))
  }

  function handleClearGroup(groupLetter: string) {
    setSaveSuccess(false)
    setSuccessMessage(null)
    setGroupRankings((prev) => ({
      ...prev,
      [groupLetter]: [],
    }))
  }

  async function handleSave() {
    if (unsavedGroupCount === 0) return

    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    setSaveSuccess(false)

    const rows = groups
      .map((group) => ({
        pool_id: pool.id,
        member_id: memberId,
        group_name: group.letter,
        standings: groupRankings[group.letter] ?? [],
        updated_at: new Date().toISOString(),
      }))
      .filter((row) => {
        const current = row.standings
        const baseline = baselineRankings[row.group_name] ?? []
        return current.length > 0 && !rankingsEqual(current, baseline)
      })

    if (rows.length === 0) {
      setSaving(false)
      return
    }

    const { error: upsertError } = await supabase
      .from('group_predictions')
      .upsert(rows, { onConflict: 'pool_id,member_id,group_name' })

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    setBaselineRankings((prev) => {
      const next = cloneGroupRankings(prev)
      rows.forEach((row) => {
        next[row.group_name] = [...row.standings]
      })
      return next
    })
    setSaveSuccess(true)
    setSuccessMessage(
      `Saved ${rows.length} group${rows.length === 1 ? '' : 's'}`,
    )
    window.setTimeout(() => setSaveSuccess(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-3 sm:py-4">
          <Link
            href={`/pool/${inviteCode}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="truncate">{pool.name}</span>
          </Link>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="font-display text-3xl tracking-wide text-foreground uppercase sm:text-4xl">
              Predictions
            </h1>
            <p className="font-mono text-xs text-muted-foreground sm:text-sm">
              {predictedGroupCount}/12 groups ranked
            </p>
          </div>

          <ProgressHeader
            current={predictedGroupCount}
            total={12}
            label="Groups Predicted"
          />

          <WinnerOnlyRoundTabs activeId={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {successMessage && (
          <div className="animate-in fade-in rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary duration-300">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {lockedRoundTab ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {WINNER_ONLY_LOCKED_ROUND_MESSAGE}
          </p>
        ) : matchesLoading || !predictionsLoaded ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading groups…
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <GroupStandingCard
                key={group.letter}
                groupLetter={group.letter}
                teams={group.teams}
                standings={groupRankings[group.letter] ?? []}
                onTeamTap={(teamName) => handleTeamTap(group.letter, teamName)}
                onClear={() => handleClearGroup(group.letter)}
              />
            ))}
          </div>
        )}
      </main>

      <SaveBar
        unsavedCount={unsavedGroupCount}
        saving={saving}
        success={saveSuccess}
        disabled={unsavedGroupCount === 0}
        onSave={handleSave}
      />
    </div>
  )
}
