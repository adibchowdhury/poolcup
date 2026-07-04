'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GroupStandingCard } from '@/components/predict/group-standing-card'
import {
  KnockoutBracketTab,
  isKnockoutBracketTab,
  KNOCKOUT_PICK_LABELS,
} from '@/components/predict/knockout-bracket-tab'
import type { KnockoutRoundBracketProps, R32BracketInteractiveProps } from '@/components/predict/knockout-bracket-preview'
import { ProgressHeader } from '@/components/predict/progress-header'
import {
  WinnerOnlyRoundTabs,
  type WinnerOnlyRoundTabId,
} from '@/components/predict/winner-only-round-tabs'
import { ThirdPlaceRankingPanel } from '@/components/pool/third-place-ranking-panel'
import { useClientNow } from '@/hooks/use-client-now'
import { cn } from '@/lib/utils'
import {
  buildWorldCupGroups,
  countCompleteGroups,
  emptyGroupRankings,
  getLatestGroupStageKickoffMs,
  isGroupRankingLocked,
  isThirdPlaceRankingLocked,
  type GroupRankings,
  type GroupStageMatch,
  type WorldCupGroupLetter,
} from '@/src/lib/world-cup-groups'
import {
  countR32AdvancePicks,
  WINNER_ONLY_KNOCKOUT_PICK_TOTALS,
  type R32BracketMatchesByNumber,
} from '@/src/lib/winner-only-r32-bracket'
import { fetchWinnerBracketPredictionsMobile } from '../lib/fetch-winner-bracket-predictions-mobile'
import { fetchWinnerKnockoutR16Mobile, fetchWinnerKnockoutR32Mobile } from '../lib/fetch-winner-knockout-r32-mobile'
import { supabase } from '../lib/supabase-mobile'

const TOTAL_GROUPS = 12
const REQUIRED_THIRD_PLACE_PICKS = 8

type MobileWinnerBracketPredictionsReadonlyProps = {
  poolId: string
  memberId: string
  userId: string
}

export function MobileWinnerBracketPredictionsReadonly({
  poolId,
  memberId,
  userId,
}: MobileWinnerBracketPredictionsReadonlyProps) {
  const { mounted, nowMs } = useClientNow(1000)
  const [activeTab, setActiveTab] = useState<WinnerOnlyRoundTabId>('bracket')
  const [groupRankings, setGroupRankings] = useState<GroupRankings>(
    emptyGroupRankings(),
  )
  const [thirdPlaceRankings, setThirdPlaceRankings] = useState<string[]>([])
  const [matches, setMatches] = useState<GroupStageMatch[]>([])
  const [r32MatchesByNumber, setR32MatchesByNumber] =
    useState<R32BracketMatchesByNumber>(() => new Map())
  const [r16MatchesByNumber, setR16MatchesByNumber] =
    useState<R32BracketMatchesByNumber>(() => new Map())
  const [bracketLoading, setBracketLoading] = useState(true)
  const [knockoutLoading, setKnockoutLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [knockoutError, setKnockoutError] = useState<string | null>(null)

  const loadBracketPhase = useCallback(async () => {
    setBracketLoading(true)
    setError(null)

    const result = await fetchWinnerBracketPredictionsMobile(
      supabase,
      poolId,
      memberId,
      userId,
    )

    setGroupRankings(result.groupRankings)
    setThirdPlaceRankings(result.thirdPlaceRankings)
    setMatches(result.matches)
    setError(result.error)
    setBracketLoading(false)
  }, [memberId, poolId, userId])

  const loadKnockoutPhase = useCallback(async () => {
    setKnockoutLoading(true)
    setKnockoutError(null)

    const [r32Result, r16Result] = await Promise.all([
      fetchWinnerKnockoutR32Mobile(supabase, poolId, memberId),
      fetchWinnerKnockoutR16Mobile(supabase, poolId, memberId),
    ])

    setR32MatchesByNumber(r32Result.matchesByNumber)
    setR16MatchesByNumber(r16Result.matchesByNumber)
    setKnockoutError(r32Result.error ?? r16Result.error)
    setKnockoutLoading(false)
  }, [memberId, poolId])

  useEffect(() => {
    void loadBracketPhase()
    void loadKnockoutPhase()
  }, [loadBracketPhase, loadKnockoutPhase])

  const groups = useMemo(() => buildWorldCupGroups(matches), [matches])

  const isGroupLocked = useCallback(
    (groupLetter: WorldCupGroupLetter) =>
      isGroupRankingLocked(
        groupLetter,
        matches,
        mounted ? nowMs : Date.now(),
      ),
    [matches, mounted, nowMs],
  )

  const isThirdPlaceLocked = useMemo(
    () =>
      isThirdPlaceRankingLocked(matches, mounted ? nowMs : Date.now()),
    [matches, mounted, nowMs],
  )

  const thirdPlaceLockKickoffAtMs = useMemo(
    () => getLatestGroupStageKickoffMs(matches),
    [matches],
  )

  const predictedGroupCount = useMemo(
    () => countCompleteGroups(groupRankings, groups),
    [groupRankings, groups],
  )

  const thirdPlacePickedCount = Math.min(
    thirdPlaceRankings.length,
    REQUIRED_THIRD_PLACE_PICKS,
  )

  const r32PickCount = useMemo(
    () => countR32AdvancePicks(r32MatchesByNumber),
    [r32MatchesByNumber],
  )

  const r16PickCount = useMemo(
    () => countR32AdvancePicks(r16MatchesByNumber),
    [r16MatchesByNumber],
  )

  const r32Bracket = useMemo<R32BracketInteractiveProps>(
    () => ({
      matchesByNumber: r32MatchesByNumber,
      nowMs: mounted ? nowMs : Date.now(),
      onAdvancePick: () => {},
    }),
    [mounted, nowMs, r32MatchesByNumber],
  )

  const r16Bracket = useMemo<KnockoutRoundBracketProps>(
    () => ({
      matchesByNumber: r16MatchesByNumber,
      nowMs: mounted ? nowMs : Date.now(),
      onAdvancePick: () => {},
    }),
    [mounted, nowMs, r16MatchesByNumber],
  )

  const loading = bracketLoading || knockoutLoading

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading predictions…</p>
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div
        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
        role="status"
      >
        View-only — winner pool predictions cannot be changed in the app yet.
      </div>

      <WinnerOnlyRoundTabs activeId={activeTab} onChange={setActiveTab} />

      {activeTab === 'bracket' ? (
        <>
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

          <p className="text-center text-sm text-muted-foreground">
            Rank all 4 teams in every group — 1st, 2nd, 3rd, and who gets
            eliminated — then pick your best 3rd-place teams.
          </p>

          <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-1.5 min-[360px]:grid-cols-[repeat(2,minmax(0,1fr))] min-[360px]:gap-2 [&>*]:min-w-0">
            {groups.map((group) => (
              <div key={group.letter} className="pointer-events-none min-w-0">
                <GroupStandingCard
                  groupLetter={group.letter}
                  teams={group.teams}
                  standings={groupRankings[group.letter] ?? []}
                  readOnly={isGroupLocked(group.letter)}
                  onTeamTap={() => {}}
                />
              </div>
            ))}
          </div>

          <div className="pointer-events-none w-full min-w-0">
            <ThirdPlaceRankingPanel
              groupRankings={groupRankings}
              thirdPlaceRankings={thirdPlaceRankings}
              readOnly
              locked={isThirdPlaceLocked}
              lockKickoffAtMs={thirdPlaceLockKickoffAtMs}
              onThirdPlaceTeamTap={() => {}}
            />
          </div>
        </>
      ) : (
        <div
          className={cn(
            'pointer-events-none min-w-0',
            (activeTab === 'r32' || activeTab === 'r16') && 'pb-24',
          )}
        >
          {knockoutError ? (
            <p className="text-sm text-destructive" role="alert">
              {knockoutError}
            </p>
          ) : (
            <>
              {activeTab === 'r32' ? (
                <div className="mb-4 min-w-0 space-y-1">
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
              ) : activeTab === 'r16' ? (
                <div className="mb-4 min-w-0 space-y-1">
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
              ) : isKnockoutBracketTab(activeTab) ? (
                <div className="mb-4 min-w-0 space-y-1">
                  <ProgressHeader
                    current={0}
                    total={WINNER_ONLY_KNOCKOUT_PICK_TOTALS[activeTab]}
                    label={KNOCKOUT_PICK_LABELS[activeTab]}
                    labelFirst
                    className="opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">
                    {activeTab === 'qf'
                      ? 'Unlocks once the Round of 16 is complete.'
                      : activeTab === 'sf'
                        ? 'Unlocks once the Quarterfinals end.'
                        : 'Unlocks once the Semifinals end.'}
                  </p>
                </div>
              ) : null}

              <KnockoutBracketTab
                tab={activeTab}
                r32Bracket={r32Bracket}
                r16Bracket={r16Bracket}
                embedded
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
