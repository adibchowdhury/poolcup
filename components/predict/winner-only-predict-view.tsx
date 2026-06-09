'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { GroupStandingCard } from '@/components/predict/group-standing-card'
import { PoolBracketTab } from '@/components/pool/pool-bracket-tab'
import { ScoringModeBadge } from '@/components/pool/scoring-mode-badge'
import { ProgressHeader } from '@/components/predict/progress-header'
import { SaveBar } from '@/components/predict/save-bar'
import { SaveSuccessToast } from '@/components/predict/save-success-toast'
import {
  WinnerOnlyRoundTabs,
  WINNER_ONLY_LOCKED_ROUND_MESSAGE,
  isWinnerOnlyLockedRoundTab,
  type WinnerOnlyRoundTabId,
} from '@/components/predict/winner-only-round-tabs'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'
import {
  WORLD_CUP_GROUP_LETTERS,
  buildWorldCupGroups,
  cloneGroupRankings,
  countCompleteGroups,
  emptyGroupRankings,
  getAvailableThirdPlaceTeams,
  isGroupStageLocked,
  parseStandingsJson,
  parseThirdPlaceRankingsJson,
  rankingsEqual,
  syncThirdPlaceRankings,
  tapTeamInGroup,
  type GroupRankings,
  type GroupStageMatch,
  type WorldCupGroupLetter,
} from '@/src/lib/world-cup-groups'
import { cn } from '@/lib/utils'

type Pool = {
  id: string
  name: string
  invite_code: string
  scoring_style: string
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
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<WinnerOnlyRoundTabId>('bracket')
  const [groupRankings, setGroupRankings] = useState<GroupRankings>(
    emptyGroupRankings(),
  )
  const [baselineRankings, setBaselineRankings] = useState<GroupRankings>(
    emptyGroupRankings(),
  )
  const [thirdPlaceRankings, setThirdPlaceRankings] = useState<string[]>([])
  const [baselineThirdPlaceRankings, setBaselineThirdPlaceRankings] = useState<
    string[]
  >([])
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
    if (!user?.id) return

    const [groupResult, thirdPlaceResult] = await Promise.all([
      supabase
        .from('group_predictions')
        .select('group_name, standings')
        .eq('pool_id', pool.id)
        .eq('member_id', memberId),
      supabase
        .from('third_place_rankings')
        .select('rankings')
        .eq('pool_id', pool.id)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (groupResult.error) {
      console.error('Failed to load group predictions:', groupResult.error.message)
      setError('Failed to load saved group predictions')
      setPredictionsLoaded(true)
      return
    }

    const initial = emptyGroupRankings()
    for (const row of (groupResult.data ?? []) as GroupPredictionRow[]) {
      const letter = row.group_name.toUpperCase()
      if (WORLD_CUP_GROUP_LETTERS.includes(letter as (typeof WORLD_CUP_GROUP_LETTERS)[number])) {
        initial[letter] = parseStandingsJson(row.standings)
      }
    }

    const loadedThirdPlace = parseThirdPlaceRankingsJson(
      thirdPlaceResult.data?.rankings,
    )
    const syncedThirdPlace = syncThirdPlaceRankings(loadedThirdPlace, initial)

    if (thirdPlaceResult.error) {
      console.error(
        'Failed to load third place rankings:',
        thirdPlaceResult.error.message,
      )
    }

    setGroupRankings(initial)
    setBaselineRankings(cloneGroupRankings(initial))
    setThirdPlaceRankings(syncedThirdPlace)
    setBaselineThirdPlaceRankings([...syncedThirdPlace])
    setPredictionsLoaded(true)
  }, [memberId, pool.id, user?.id])

  useEffect(() => {
    loadGroupPredictions()
  }, [loadGroupPredictions])

  const predictedGroupCount = useMemo(
    () => countCompleteGroups(groupRankings, groups),
    [groupRankings, groups],
  )

  const unsavedGroupCount = useMemo(() => {
    let count = groups.filter((group) => {
      const current = groupRankings[group.letter] ?? []
      const baseline = baselineRankings[group.letter] ?? []
      if (current.length === 0) return false
      return !rankingsEqual(current, baseline)
    }).length

    if (!rankingsEqual(thirdPlaceRankings, baselineThirdPlaceRankings)) {
      count += 1
    }

    return count
  }, [
    baselineRankings,
    baselineThirdPlaceRankings,
    groupRankings,
    groups,
    thirdPlaceRankings,
  ])

  const groupStageLocked = isGroupStageLocked()

  const dismissSuccessToast = useCallback(() => {
    setSuccessMessage(null)
  }, [])

  function handleTeamTap(groupLetter: string, teamName: string) {
    const group = groups.find((g) => g.letter === groupLetter)
    if (!group) return

    setSaveSuccess(false)
    setSuccessMessage(null)
    setGroupRankings((prev) => {
      const next = {
        ...prev,
        [groupLetter]: tapTeamInGroup(
          prev[groupLetter] ?? [],
          teamName,
          group.teams,
        ),
      }
      setThirdPlaceRankings((tp) => syncThirdPlaceRankings(tp, next))
      return next
    })
  }

  function handleClearGroup(groupLetter: string) {
    setSaveSuccess(false)
    setSuccessMessage(null)
    setGroupRankings((prev) => {
      const next = {
        ...prev,
        [groupLetter]: [],
      }
      setThirdPlaceRankings((tp) => syncThirdPlaceRankings(tp, next))
      return next
    })
  }

  function handleThirdPlaceTeamTap(teamName: string) {
    const available = getAvailableThirdPlaceTeams(groupRankings)
    if (!available.includes(teamName)) return

    setSaveSuccess(false)
    setSuccessMessage(null)
    setThirdPlaceRankings((prev) =>
      tapTeamInGroup(prev, teamName, available),
    )
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

    const thirdPlaceChanged = !rankingsEqual(
      thirdPlaceRankings,
      baselineThirdPlaceRankings,
    )

    if (rows.length === 0 && !thirdPlaceChanged) {
      setSaving(false)
      return
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('group_predictions')
        .upsert(rows, { onConflict: 'pool_id,member_id,group_name' })

      if (upsertError) {
        setSaving(false)
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
    }

    if (thirdPlaceChanged) {
      if (!user?.id) {
        setSaving(false)
        setError('You must be signed in to save third place rankings')
        return
      }

      const { error: thirdPlaceError } = await supabase
        .from('third_place_rankings')
        .upsert(
          {
            pool_id: pool.id,
            user_id: user.id,
            rankings: thirdPlaceRankings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'pool_id,user_id' },
        )

      if (thirdPlaceError) {
        setSaving(false)
        setError(thirdPlaceError.message)
        return
      }

      setBaselineThirdPlaceRankings([...thirdPlaceRankings])
    }

    setSaving(false)
    setSaveSuccess(true)

    const savedParts: string[] = []
    if (rows.length > 0) {
      savedParts.push(`${rows.length} group${rows.length === 1 ? '' : 's'}`)
    }
    if (thirdPlaceChanged) {
      savedParts.push('3rd place rankings')
    }
    setSuccessMessage(`Saved ${savedParts.join(' and ')}`)
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

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="font-display text-3xl tracking-wide text-foreground uppercase sm:text-4xl">
              Predictions
            </h1>
            <ScoringModeBadge scoringStyle={pool.scoring_style} />
          </div>

          <ProgressHeader
            current={predictedGroupCount}
            total={12}
            label="Groups ranked"
            labelFirst
          />

          <WinnerOnlyRoundTabs activeId={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      <main
        className={cn(
          activeTab === 'bracket' ? 'py-4' : 'mx-auto max-w-3xl space-y-4 px-4 py-4',
        )}
      >
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {activeTab === 'bracket' ? (
          matchesLoading || !predictionsLoaded ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              Loading bracket…
            </p>
          ) : (
            <div className="space-y-4">
              <p className="mx-auto max-w-2xl px-4 text-center text-sm text-muted-foreground">
                Rank each group from 1st to 4th, then rank your best 3rd-place
                teams. Your knockout bracket fills in automatically as you go.
              </p>
              <PoolBracketTab
                groups={groups}
                groupRankings={groupRankings}
                thirdPlaceRankings={thirdPlaceRankings}
                readOnly={groupStageLocked}
                onTeamTap={handleTeamTap}
                onThirdPlaceTeamTap={handleThirdPlaceTeamTap}
              />
            </div>
          )
        ) : lockedRoundTab ? (
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

      {!lockedRoundTab && (
        <SaveBar
          unsavedCount={unsavedGroupCount}
          saving={saving}
          success={saveSuccess}
          disabled={unsavedGroupCount === 0}
          onSave={handleSave}
        />
      )}

      <SaveSuccessToast
        message={successMessage}
        onDismiss={dismissSuccessToast}
      />
    </div>
  )
}
