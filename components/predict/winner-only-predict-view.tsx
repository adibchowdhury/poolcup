'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useClientNow } from '@/hooks/use-client-now'
import { PoolBracketTab } from '@/components/pool/pool-bracket-tab'
import { ThirdPlaceRankingPanel } from '@/components/pool/third-place-ranking-panel'
import { ScoringModeBadge } from '@/components/pool/scoring-mode-badge'
import { GroupStandingCard } from '@/components/predict/group-standing-card'
import { ProgressHeader } from '@/components/predict/progress-header'
import { SaveBar } from '@/components/predict/save-bar'
import { MOBILE_SAVE_BAR_SCROLL_PAD_ABOVE_NAV_CLASS, SAVE_BAR_SOLO_SCROLL_PAD_CLASS } from '@/src/lib/mobile-bottom-nav-routes'
import { SaveSuccessToast } from '@/components/predict/save-success-toast'
import {
  WinnerOnlyRoundTabs,
  type WinnerOnlyRoundTabId,
} from '@/components/predict/winner-only-round-tabs'
import type { ClassicRoundTabId } from '@/components/predict/group-knockout-tabs'
import { KnockoutBracketTab, isKnockoutBracketTab, KNOCKOUT_PICK_LABELS } from '@/components/predict/knockout-bracket-tab'
import type { R32BracketInteractiveProps, KnockoutRoundBracketProps } from '@/components/predict/knockout-bracket-preview'
import {
  advancePickScores,
  countR32AdvancePicks,
  countR32UnsavedPicks,
  isR32MatchLocked,
  WINNER_ONLY_KNOCKOUT_PICK_TOTALS,
  type R32BracketMatchesByNumber,
} from '@/src/lib/winner-only-r32-bracket'
import { fetchWinnerKnockoutRoundMatches } from '@/src/lib/fetch-winner-knockout-round'
import { upsertPoolMatchPrediction } from '@/src/lib/pool-match-prediction-write'
import { resolveDefaultClassicRoundTabForPredictions } from '@/src/lib/classic-round-tab-logic'
import { useAuth } from '@/src/lib/auth-context'
import { capturePostHog } from '@/src/lib/posthog-client'
import { trackEvent } from '@/src/lib/track'
import { supabase } from '@/src/lib/supabase'
import {
  WORLD_CUP_GROUP_LETTERS,
  buildWorldCupGroups,
  cloneGroupRankings,
  countCompleteGroups,
  emptyGroupRankings,
  getAvailableThirdPlaceTeams,
  getLatestGroupStageKickoffMs,
  isGroupRankingLocked,
  isThirdPlaceRankingLocked,
  parseStandingsJson,
  parseThirdPlaceRankingsJson,
  rankingsEqual,
  syncThirdPlaceRankings,
  tapGroupTeamWithAutoFourth,
  tapThirdPlaceTeamWithAutoEliminated,
  tapTeamInGroup,
  THIRD_PLACE_LOCKED_LABEL,
  type GroupRankings,
  type GroupStageMatch,
  type WorldCupGroupLetter,
} from '@/src/lib/world-cup-groups'
import { cn } from '@/lib/utils'

const TOTAL_GROUPS = 12
const REQUIRED_THIRD_PLACE_PICKS = 8

function winnerOnlyTabFromClassicRound(
  tab: ClassicRoundTabId,
): WinnerOnlyRoundTabId {
  return tab === 'group' ? 'bracket' : tab
}

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
  /** When true, omits full-page chrome (back link, title) for use inside the pool tab. */
  embedded?: boolean
}

export function WinnerOnlyPredictView({
  pool,
  memberId,
  inviteCode,
  embedded = false,
}: WinnerOnlyPredictViewProps) {
  const { user } = useAuth()
  const { mounted, nowMs } = useClientNow(1000)
  const [activeTab, setActiveTab] = useState<WinnerOnlyRoundTabId>('bracket')
  const defaultRoundTabSetRef = useRef(false)
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
  const [saveBarError, setSaveBarError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [matches, setMatches] = useState<GroupStageMatch[]>([])
  const [teamToGroup, setTeamToGroup] = useState<
    Map<string, WorldCupGroupLetter>
  >(new Map())
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [r32MatchesByNumber, setR32MatchesByNumber] =
    useState<R32BracketMatchesByNumber>(() => new Map())
  const [r32BracketLoaded, setR32BracketLoaded] = useState(false)
  const [r16MatchesByNumber, setR16MatchesByNumber] =
    useState<R32BracketMatchesByNumber>(() => new Map())
  const [r16BracketLoaded, setR16BracketLoaded] = useState(false)
  const predictionsCompletedTrackedRef = useRef(false)
  const thirdPlaceStartedTrackedRef = useRef(false)

  useEffect(() => {
    if (thirdPlaceStartedTrackedRef.current || !user?.id) return

    thirdPlaceStartedTrackedRef.current = true
    trackEvent('third_place_started', {
      poolId: pool.id,
      userId: user.id,
      metadata: { pool_id: pool.id },
    })
  }, [pool.id, user?.id])

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true)

    const [matchesResult, teamGroupResult] = await Promise.all([
      supabase
        .from('matches')
        .select('round, group_name, team1_name, team2_name, kickoff_at, locked_at')
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

  useEffect(() => {
    let cancelled = false

    async function loadR32Bracket() {
      try {
        const { data: matchRows, error: matchesError } = await supabase
          .from('matches')
          .select('id, match_number, team1_name, team2_name, locked_at')
          .eq('round', 'r32')

        if (cancelled) return

        if (matchesError) {
          console.error(
            '[WinnerOnly] Failed to load r32 matches:',
            matchesError.message,
          )
          setR32MatchesByNumber(new Map())
          return
        }

        const rows = matchRows ?? []
        const matchIds = rows.map((row) => row.id)

        let pickByMatchId = new Map<string, 1 | 2>()
        if (matchIds.length > 0) {
          const { data: predictionRows, error: predictionsError } =
            await supabase
              .from('predictions')
              .select('match_id, advance_pick')
              .eq('pool_id', pool.id)
              .eq('member_id', memberId)
              .in('match_id', matchIds)

          if (cancelled) return

          if (predictionsError) {
            console.error(
              '[WinnerOnly] Failed to load r32 predictions:',
              predictionsError.message,
            )
          } else {
            for (const row of predictionRows ?? []) {
              if (row.advance_pick === 1 || row.advance_pick === 2) {
                pickByMatchId.set(row.match_id, row.advance_pick)
              }
            }
          }
        }

        const map: R32BracketMatchesByNumber = new Map()
        for (const row of rows) {
          const pick = pickByMatchId.get(row.id) ?? null
          map.set(row.match_number, {
            matchId: row.id,
            matchNumber: row.match_number,
            team1Name: row.team1_name,
            team2Name: row.team2_name,
            lockedAt: row.locked_at,
            myPick: pick,
            savedPick: pick,
          })
        }
        setR32MatchesByNumber(map)
      } finally {
        if (!cancelled) {
          setR32BracketLoaded(true)
        }
      }
    }

    void loadR32Bracket()

    return () => {
      cancelled = true
    }
  }, [memberId, pool.id])

  useEffect(() => {
    let cancelled = false

    async function loadR16Bracket() {
      try {
        const { matchesByNumber, error } = await fetchWinnerKnockoutRoundMatches(
          supabase,
          'r16',
          pool.id,
          memberId,
        )

        if (cancelled) return

        if (error) {
          console.error('[WinnerOnly] Failed to load r16 matches:', error)
          setR16MatchesByNumber(new Map())
          return
        }

        setR16MatchesByNumber(matchesByNumber)
      } finally {
        if (!cancelled) {
          setR16BracketLoaded(true)
        }
      }
    }

    void loadR16Bracket()

    return () => {
      cancelled = true
    }
  }, [memberId, pool.id])

  useEffect(() => {
    if (
      defaultRoundTabSetRef.current ||
      matchesLoading ||
      !r32BracketLoaded ||
      !r16BracketLoaded
    ) {
      return
    }

    const roundTabItems: Array<{ round: string; lockedAt: string | null }> = [
      ...matches.map((match) => ({
        round: match.round,
        lockedAt: match.locked_at ?? null,
      })),
      ...[...r32MatchesByNumber.values()].map((match) => ({
        round: 'r32',
        lockedAt: match.lockedAt,
      })),
      ...[...r16MatchesByNumber.values()].map((match) => ({
        round: 'r16',
        lockedAt: match.lockedAt,
      })),
    ]

    if (roundTabItems.length === 0) {
      return
    }

    setActiveTab(
      winnerOnlyTabFromClassicRound(
        resolveDefaultClassicRoundTabForPredictions(roundTabItems),
      ),
    )
    defaultRoundTabSetRef.current = true
  }, [matches, matchesLoading, r16BracketLoaded, r16MatchesByNumber, r32BracketLoaded, r32MatchesByNumber])

  const handleR32AdvancePick = useCallback(
    (matchId: string, pick: 1 | 2) => {
      const currentMatch = [...r32MatchesByNumber.values()].find(
        (match) => match.matchId === matchId,
      )
      if (!currentMatch || currentMatch.myPick === pick) {
        return
      }

      if (isR32MatchLocked(currentMatch, mounted ? nowMs : Date.now())) {
        return
      }

      setSaveSuccess(false)
      setSaveBarError(null)
      setR32MatchesByNumber((prev) => {
        const next = new Map(prev)
        const existing = [...next.values()].find((match) => match.matchId === matchId)
        if (!existing) return prev
        next.set(existing.matchNumber, { ...existing, myPick: pick })
        return next
      })
    },
    [mounted, nowMs, r32MatchesByNumber],
  )

  const handleR16AdvancePick = useCallback(
    (matchId: string, pick: 1 | 2) => {
      const currentMatch = [...r16MatchesByNumber.values()].find(
        (match) => match.matchId === matchId,
      )
      if (!currentMatch || currentMatch.myPick === pick) {
        return
      }

      if (isR32MatchLocked(currentMatch, mounted ? nowMs : Date.now())) {
        return
      }

      setSaveSuccess(false)
      setSaveBarError(null)
      setR16MatchesByNumber((prev) => {
        const next = new Map(prev)
        const existing = [...next.values()].find((match) => match.matchId === matchId)
        if (!existing) return prev
        next.set(existing.matchNumber, { ...existing, myPick: pick })
        return next
      })
    },
    [mounted, nowMs, r16MatchesByNumber],
  )

  const r32PickCount = useMemo(
    () => countR32AdvancePicks(r32MatchesByNumber),
    [r32MatchesByNumber],
  )

  const r32Bracket = useMemo<R32BracketInteractiveProps>(
    () => ({
      matchesByNumber: r32MatchesByNumber,
      nowMs: mounted ? nowMs : Date.now(),
      onAdvancePick: (matchId, pick) => {
        handleR32AdvancePick(matchId, pick)
      },
    }),
    [handleR32AdvancePick, mounted, nowMs, r32MatchesByNumber],
  )

  const r16PickCount = useMemo(
    () => countR32AdvancePicks(r16MatchesByNumber),
    [r16MatchesByNumber],
  )

  const r16Bracket = useMemo<KnockoutRoundBracketProps>(
    () => ({
      matchesByNumber: r16MatchesByNumber,
      nowMs: mounted ? nowMs : Date.now(),
      onAdvancePick: (matchId, pick) => {
        handleR16AdvancePick(matchId, pick)
      },
    }),
    [handleR16AdvancePick, mounted, nowMs, r16MatchesByNumber],
  )

  const groups = useMemo(() => {
    return buildWorldCupGroups(
      matches,
      teamToGroup.size > 0 ? teamToGroup : undefined,
    )
  }, [matches, teamToGroup])

  const unsavedR32Count = useMemo(
    () =>
      countR32UnsavedPicks(
        r32MatchesByNumber,
        mounted ? nowMs : Date.now(),
      ),
    [mounted, nowMs, r32MatchesByNumber],
  )

  const unsavedR16Count = useMemo(
    () =>
      countR32UnsavedPicks(
        r16MatchesByNumber,
        mounted ? nowMs : Date.now(),
      ),
    [mounted, nowMs, r16MatchesByNumber],
  )

  const r32FullyComplete = useMemo(
    () => r32PickCount >= WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r32,
    [r32PickCount],
  )

  const r16FullyComplete = useMemo(
    () => r16PickCount >= WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r16,
    [r16PickCount],
  )

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

  const thirdPlacePickedCount = Math.min(
    thirdPlaceRankings.length,
    REQUIRED_THIRD_PLACE_PICKS,
  )

  const groupsRankingComplete = predictedGroupCount >= TOTAL_GROUPS
  const thirdPlacePickingComplete =
    thirdPlaceRankings.length >= REQUIRED_THIRD_PLACE_PICKS
  const predictionsFullyComplete =
    groupsRankingComplete && thirdPlacePickingComplete

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

  const isGroupLocked = useCallback(
    (groupLetter: WorldCupGroupLetter) =>
      isGroupRankingLocked(
        groupLetter,
        matches,
        mounted ? nowMs : Date.now(),
        teamToGroup.size > 0 ? teamToGroup : undefined,
      ),
    [matches, mounted, nowMs, teamToGroup],
  )

  const isThirdPlaceLocked = useMemo(
    () =>
      isThirdPlaceRankingLocked(
        matches,
        mounted ? nowMs : Date.now(),
        teamToGroup.size > 0 ? teamToGroup : undefined,
      ),
    [matches, mounted, nowMs, teamToGroup],
  )

  const thirdPlaceLockKickoffAtMs = useMemo(
    () =>
      getLatestGroupStageKickoffMs(
        matches,
        teamToGroup.size > 0 ? teamToGroup : undefined,
      ),
    [matches, teamToGroup],
  )

  const canSaveChanges = useMemo(() => {
    const hasUnlockedGroupSaves = groups.some((group) => {
      const current = groupRankings[group.letter] ?? []
      const baseline = baselineRankings[group.letter] ?? []
      if (current.length === 0 || rankingsEqual(current, baseline)) return false
      return !isGroupLocked(group.letter)
    })
    const thirdPlaceChanged = !rankingsEqual(
      thirdPlaceRankings,
      baselineThirdPlaceRankings,
    )
    const thirdPlaceSaveable = thirdPlaceChanged && !isThirdPlaceLocked
    return hasUnlockedGroupSaves || thirdPlaceSaveable
  }, [
    baselineRankings,
    baselineThirdPlaceRankings,
    groupRankings,
    groups,
    isGroupLocked,
    isThirdPlaceLocked,
    thirdPlaceRankings,
  ])

  const showSaveBar =
    activeTab === 'bracket' || activeTab === 'r32' || activeTab === 'r16'
  const saveBarUnsavedCount =
    activeTab === 'r32'
      ? unsavedR32Count
      : activeTab === 'r16'
        ? unsavedR16Count
        : unsavedGroupCount
  const saveBarComplete =
    activeTab === 'r32'
      ? r32FullyComplete
      : activeTab === 'r16'
        ? r16FullyComplete
        : predictionsFullyComplete
  const saveBarDisabled =
    activeTab === 'r32'
      ? unsavedR32Count === 0
      : activeTab === 'r16'
        ? unsavedR16Count === 0
        : unsavedGroupCount === 0 || !canSaveChanges

  const dismissSuccessToast = useCallback(() => {
    setSuccessMessage(null)
  }, [])

  function handleTeamTap(groupLetter: string, teamName: string) {
    if (isGroupLocked(groupLetter as WorldCupGroupLetter)) return

    const group = groups.find((g) => g.letter === groupLetter)
    if (!group) return

    setSaveSuccess(false)
    setSaveBarError(null)
    setSuccessMessage(null)
    setGroupRankings((prev) => {
      const next = {
        ...prev,
        [groupLetter]: tapGroupTeamWithAutoFourth(
          prev[groupLetter] ?? [],
          teamName,
          group.teams,
        ),
      }
      setThirdPlaceRankings((tp) => syncThirdPlaceRankings(tp, next))
      return next
    })
  }

  function handleThirdPlaceTeamTap(teamName: string) {
    if (isThirdPlaceLocked) return

    const available = getAvailableThirdPlaceTeams(groupRankings)
    if (!available.includes(teamName)) return

    setSaveSuccess(false)
    setSaveBarError(null)
    setSuccessMessage(null)
    setThirdPlaceRankings((prev) =>
      tapThirdPlaceTeamWithAutoEliminated(prev, teamName, available),
    )
  }

  async function handleR32Save() {
    if (unsavedR32Count === 0) return

    setSaving(true)
    setSaveBarError(null)
    setSaveSuccess(false)
    setSuccessMessage(null)

    const now = mounted ? nowMs : Date.now()
    let savedCount = 0
    let lockedCount = 0
    let errorCount = 0

    for (const match of r32MatchesByNumber.values()) {
      if (match.myPick === match.savedPick) continue

      if (isR32MatchLocked(match, now)) {
        lockedCount += 1
        setR32MatchesByNumber((prev) => {
          const next = new Map(prev)
          const existing = next.get(match.matchNumber)
          if (!existing) return prev
          next.set(match.matchNumber, {
            ...existing,
            myPick: existing.savedPick,
          })
          return next
        })
        continue
      }

      if (match.myPick !== 1 && match.myPick !== 2) {
        continue
      }

      const scores = advancePickScores(match.myPick)
      const result = await upsertPoolMatchPrediction(supabase, {
        poolId: pool.id,
        memberId,
        matchId: match.matchId,
        predTeam1: scores.predTeam1,
        predTeam2: scores.predTeam2,
        advancePick: match.myPick,
      })

      if (!result.ok) {
        if (result.isLockViolation) {
          lockedCount += 1
          setR32MatchesByNumber((prev) => {
            const next = new Map(prev)
            const existing = next.get(match.matchNumber)
            if (!existing) return prev
            next.set(match.matchNumber, {
              ...existing,
              myPick: existing.savedPick,
            })
            return next
          })
        } else {
          errorCount += 1
        }
        continue
      }

      setR32MatchesByNumber((prev) => {
        const next = new Map(prev)
        const existing = next.get(match.matchNumber)
        if (!existing) return prev
        next.set(match.matchNumber, {
          ...existing,
          savedPick: match.myPick,
        })
        return next
      })
      savedCount += 1
      capturePostHog('prediction_submitted', {
        pool_id: pool.id,
        match_id: match.matchId,
      })
    }

    setSaving(false)

    if (errorCount > 0) {
      setSaveBarError("Couldn't save predictions")
      return
    }

    if (lockedCount > 0 && savedCount === 0) {
      setSaveBarError('This match has locked')
      return
    }

    if (lockedCount > 0) {
      setSaveBarError('Some matches have locked')
    }

    if (savedCount === 0) {
      return
    }

    setSaveSuccess(true)
    setSuccessMessage(
      `Saved ${savedCount} prediction${savedCount === 1 ? '' : 's'}`,
    )
    window.setTimeout(() => setSaveSuccess(false), 2000)
  }

  async function handleR16Save() {
    if (unsavedR16Count === 0) return

    setSaving(true)
    setSaveBarError(null)
    setSaveSuccess(false)
    setSuccessMessage(null)

    const now = mounted ? nowMs : Date.now()
    let savedCount = 0
    let lockedCount = 0
    let errorCount = 0

    for (const match of r16MatchesByNumber.values()) {
      if (match.myPick === match.savedPick) continue

      if (isR32MatchLocked(match, now)) {
        lockedCount += 1
        setR16MatchesByNumber((prev) => {
          const next = new Map(prev)
          const existing = next.get(match.matchNumber)
          if (!existing) return prev
          next.set(match.matchNumber, {
            ...existing,
            myPick: existing.savedPick,
          })
          return next
        })
        continue
      }

      if (match.myPick !== 1 && match.myPick !== 2) {
        continue
      }

      const scores = advancePickScores(match.myPick)
      const result = await upsertPoolMatchPrediction(supabase, {
        poolId: pool.id,
        memberId,
        matchId: match.matchId,
        predTeam1: scores.predTeam1,
        predTeam2: scores.predTeam2,
        advancePick: match.myPick,
      })

      if (!result.ok) {
        if (result.isLockViolation) {
          lockedCount += 1
          setR16MatchesByNumber((prev) => {
            const next = new Map(prev)
            const existing = next.get(match.matchNumber)
            if (!existing) return prev
            next.set(match.matchNumber, {
              ...existing,
              myPick: existing.savedPick,
            })
            return next
          })
        } else {
          errorCount += 1
        }
        continue
      }

      setR16MatchesByNumber((prev) => {
        const next = new Map(prev)
        const existing = next.get(match.matchNumber)
        if (!existing) return prev
        next.set(match.matchNumber, {
          ...existing,
          savedPick: match.myPick,
        })
        return next
      })
      savedCount += 1
      capturePostHog('prediction_submitted', {
        pool_id: pool.id,
        match_id: match.matchId,
      })
    }

    setSaving(false)

    if (errorCount > 0) {
      setSaveBarError("Couldn't save predictions")
      return
    }

    if (lockedCount > 0 && savedCount === 0) {
      setSaveBarError('This match has locked')
      return
    }

    if (lockedCount > 0) {
      setSaveBarError('Some matches have locked')
    }

    if (savedCount === 0) {
      return
    }

    setSaveSuccess(true)
    setSuccessMessage(
      `Saved ${savedCount} prediction${savedCount === 1 ? '' : 's'}`,
    )
    window.setTimeout(() => setSaveSuccess(false), 2000)
  }

  async function handleSave() {
    if (activeTab === 'r32') {
      await handleR32Save()
      return
    }

    if (activeTab === 'r16') {
      await handleR16Save()
      return
    }

    if (unsavedGroupCount === 0 || !canSaveChanges) {
      if (unsavedGroupCount > 0 && !canSaveChanges) {
        const thirdPlaceChanged = !rankingsEqual(
          thirdPlaceRankings,
          baselineThirdPlaceRankings,
        )
        if (thirdPlaceChanged && isThirdPlaceLocked) {
          setSaveBarError(THIRD_PLACE_LOCKED_LABEL)
        } else {
          setSaveBarError('Predictions are locked for those groups')
        }
        window.setTimeout(() => setSaveBarError(null), 3000)
      }
      return
    }

    setSaving(true)
    setSaveBarError(null)
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
        if (isGroupLocked(row.group_name as WorldCupGroupLetter)) return false
        const current = row.standings
        const baseline = baselineRankings[row.group_name] ?? []
        return current.length > 0 && !rankingsEqual(current, baseline)
      })

    const thirdPlaceChanged =
      !isThirdPlaceLocked &&
      !rankingsEqual(thirdPlaceRankings, baselineThirdPlaceRankings)

    if (rows.length === 0 && !thirdPlaceChanged) {
      setSaving(false)
      if (
        !rankingsEqual(thirdPlaceRankings, baselineThirdPlaceRankings) &&
        isThirdPlaceLocked
      ) {
        setSaveBarError(THIRD_PLACE_LOCKED_LABEL)
        window.setTimeout(() => setSaveBarError(null), 3000)
      }
      return
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('group_predictions')
        .upsert(rows, { onConflict: 'pool_id,member_id,group_name' })

      if (upsertError) {
        setSaving(false)
        setSaveBarError(upsertError.message)
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
        if (
          isThirdPlaceRankingLocked(
            matches,
            Date.now(),
            teamToGroup.size > 0 ? teamToGroup : undefined,
          )
        ) {
          setSaveBarError(THIRD_PLACE_LOCKED_LABEL)
        } else {
          setSaveBarError(thirdPlaceError.message)
        }
        return
      }

      setBaselineThirdPlaceRankings([...thirdPlaceRankings])
    }

    capturePostHog('prediction_submitted', { pool_id: pool.id })

    if (predictionsFullyComplete && !predictionsCompletedTrackedRef.current) {
      capturePostHog('predictions_completed', { pool_id: pool.id })
      predictionsCompletedTrackedRef.current = true
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
    <div
      className={cn(
        'w-full max-w-full bg-background',
        embedded
          ? cn(
              'overflow-x-visible',
              showSaveBar && MOBILE_SAVE_BAR_SCROLL_PAD_ABOVE_NAV_CLASS,
            )
          : cn('min-h-screen overflow-x-hidden', SAVE_BAR_SOLO_SCROLL_PAD_CLASS),
      )}
    >
      <header
        className={cn(
          'z-20 bg-background/95',
          embedded
            ? 'sticky top-0 overflow-x-visible border-b border-border/80 backdrop-blur-md'
            : 'sticky top-0 overflow-x-hidden border-b border-border/80 bg-background/95 backdrop-blur-md',
        )}
      >
        <div
          className={cn(
            'min-w-0 space-y-3',
            embedded
              ? 'w-full py-3'
              : 'mx-auto max-w-3xl px-4 py-3 sm:py-4',
          )}
        >
          {!embedded ? (
            <>
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
            </>
          ) : null}

          {activeTab === 'bracket' && (
            <div className="min-w-0 space-y-3">
              <div className="space-y-1">
                <ProgressHeader
                  current={predictedGroupCount}
                  total={TOTAL_GROUPS}
                  label="Groups ranked"
                  labelFirst
                />
                <p className="text-xs text-amber-400">
                  Rank all 4 teams in each group to lock it in.
                </p>
              </div>
              <ProgressHeader
                current={thirdPlacePickedCount}
                total={REQUIRED_THIRD_PLACE_PICKS}
                label="Best 3rd-place teams"
                labelFirst
              />
            </div>
          )}

          {isKnockoutBracketTab(activeTab) && (
            <div className="min-w-0 space-y-1">
              {activeTab === 'r32' ? (
                <>
                  <div className="hidden md:block">
                    <ProgressHeader
                      current={r32PickCount}
                      total={WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r32}
                      label={KNOCKOUT_PICK_LABELS.r32}
                      labelFirst
                    />
                  </div>
                  <div className="md:hidden">
                    <ProgressHeader
                      current={r32PickCount}
                      total={WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r32}
                      headline={
                        r32PickCount >= WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r32
                          ? 'All 16 picks complete'
                          : `${WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r32 - r32PickCount} picks remaining`
                      }
                    />
                  </div>
                </>
              ) : activeTab === 'r16' ? (
                <>
                  <div className="hidden md:block">
                    <ProgressHeader
                      current={r16PickCount}
                      total={WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r16}
                      label={KNOCKOUT_PICK_LABELS.r16}
                      labelFirst
                    />
                  </div>
                  <div className="md:hidden">
                    <ProgressHeader
                      current={r16PickCount}
                      total={WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r16}
                      headline={
                        r16PickCount >= WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r16
                          ? 'All 8 picks complete'
                          : `${WINNER_ONLY_KNOCKOUT_PICK_TOTALS.r16 - r16PickCount} picks remaining`
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <ProgressHeader
                    current={0}
                    total={WINNER_ONLY_KNOCKOUT_PICK_TOTALS[activeTab]}
                    label={KNOCKOUT_PICK_LABELS[activeTab]}
                    labelFirst
                    className="opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">
                    Unlocks once the Round of 32 is complete.
                  </p>
                </>
              )}
            </div>
          )}

          <WinnerOnlyRoundTabs activeId={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      <main
        className={cn(
          'w-full min-w-0 max-w-full py-4',
          embedded
            ? 'overflow-x-visible'
            : cn(
                'overflow-x-hidden',
                activeTab === 'bracket' && 'md:overflow-x-visible',
              ),
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
            <div className="w-full min-w-0 max-w-full space-y-4">
              <p className="mx-auto max-w-2xl px-4 text-center text-sm text-muted-foreground">
                Rank all 4 teams in every group — 1st, 2nd, 3rd, and who gets
                eliminated — then pick your best 3rd-place teams. Your knockout
                bracket fills in automatically as you go.
              </p>
              <div className="hidden md:block">
                <PoolBracketTab
                  groups={groups}
                  groupRankings={groupRankings}
                  thirdPlaceRankings={thirdPlaceRankings}
                  isGroupLocked={isGroupLocked}
                  isThirdPlaceLocked={isThirdPlaceLocked}
                  thirdPlaceLockKickoffAtMs={thirdPlaceLockKickoffAtMs}
                  onTeamTap={handleTeamTap}
                  onThirdPlaceTeamTap={handleThirdPlaceTeamTap}
                />
              </div>
              <div className="w-full min-w-0 max-w-full space-y-3 px-4 md:hidden">
                <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-1.5 min-[360px]:grid-cols-[repeat(2,minmax(0,1fr))] min-[360px]:gap-2 [&>*]:min-w-0">
                  {groups.map((group) => (
                    <GroupStandingCard
                      key={group.letter}
                      groupLetter={group.letter}
                      teams={group.teams}
                      standings={groupRankings[group.letter] ?? []}
                      readOnly={isGroupLocked(group.letter)}
                      onTeamTap={(teamName) =>
                        handleTeamTap(group.letter, teamName)
                      }
                    />
                  ))}
                </div>
                <div className="w-full min-w-0">
                  <ThirdPlaceRankingPanel
                    groupRankings={groupRankings}
                    thirdPlaceRankings={thirdPlaceRankings}
                    locked={isThirdPlaceLocked}
                    lockKickoffAtMs={thirdPlaceLockKickoffAtMs}
                    onThirdPlaceTeamTap={handleThirdPlaceTeamTap}
                  />
                </div>
              </div>
            </div>
          )
        ) : (
          <KnockoutBracketTab
            tab={activeTab}
            r32Bracket={r32Bracket}
            r16Bracket={r16Bracket}
            pickError={saveBarError}
            embedded={embedded}
          />
        )}
      </main>

      {showSaveBar ? (
        <SaveBar
          unsavedCount={saveBarUnsavedCount}
          saving={saving}
          success={saveSuccess}
          error={saveBarError}
          complete={saveBarComplete}
          disabled={saveBarDisabled}
          onSave={() => void handleSave()}
        />
      ) : null}

      <SaveSuccessToast
        message={successMessage}
        onDismiss={dismissSuccessToast}
      />
    </div>
  )
}
