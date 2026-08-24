'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ReportIssueButton } from '@/components/report-issue-dialog'
import { useAuth } from '@/src/lib/auth-context'
import { capturePostHog } from '@/src/lib/posthog-client'
import { supabase } from '@/src/lib/supabase'
import { resolveTeamFlag } from '@/src/lib/team-flags'
import { CompactMatchRow } from '@/components/predict/compact-match-row'
import { MatchSection, type SectionMatch } from '@/components/predict/match-section'
import { ClassicR32PreviewTab } from '@/components/predict/classic-r32-preview-tab'
import { KnockoutAdvancePicker } from '@/components/pool/prediction-match-card'
import {
  ClassicRoundTabs,
  type ClassicRoundTabId,
} from '@/components/predict/group-knockout-tabs'
import {
  classicRoundTabEmptyMessage,
  isKnockoutRound,
  isTournamentStyleMatches,
  matchInClassicRoundTab,
  resolveDefaultClassicRoundTab,
  type KnockoutRoundId,
} from '@/src/lib/classic-round-tab-logic'
import {
  hasMlsPlayoffRounds,
  isMlsPlayoffRound,
  isSeasonFlatRound,
} from '@/src/lib/mls-playoff-rounds'
import {
  SeasonPlayoffTabs,
  type SeasonPlayoffPhaseId,
} from '@/components/predict/season-playoff-tabs'
import { MlsPlayoffStageSections } from '@/components/predict/mls-playoff-stage-sections'
import { ProgressHeader } from '@/components/predict/progress-header'
import { SaveBar } from '@/components/predict/save-bar'
import {
  MOBILE_SAVE_BAR_WITH_NAV_SCROLL_PAD_CLASS,
  SAVE_BAR_SOLO_SCROLL_PAD_CLASS,
} from '@/src/lib/mobile-bottom-nav-routes'
import { SaveSuccessToast } from '@/components/predict/save-success-toast'
import {
  classicMatchTotalCount,
  hasClassicPredictionScores,
} from '@/src/lib/classic-prediction-progress'
import {
  isPredictedDraw,
  resolveAdvancePickFromScores,
} from '@/src/lib/knockout-match-prediction'
import { isMatchLocked } from '@/src/lib/match-lock'
import {
  deletePoolMatchPrediction,
  upsertPoolMatchPrediction,
} from '@/src/lib/pool-match-prediction-write'
import {
  getMatchLifecycleSection,
  MATCH_LIFECYCLE_SECTION_ORDER,
  partitionByLifecycleSection,
} from '@/src/lib/match-lifecycle-section'
import { getVoidMatchStatusLabel } from '@/src/lib/match-void-status'
import { MatchLifecycleSectionHeader } from '@/components/predict/match-lifecycle-sections'
import { cn } from '@/lib/utils'

type ScoringStyle = 'classic' | 'winner' | 'exact'

type Pool = {
  id: string
  name: string
  invite_code: string
  scoring_style: ScoringStyle
  event_id: string | null
}

type Match = {
  id: string
  kickoff_at: string
  locked_at: string | null
  team1_name: string
  team2_name: string
  team1_flag: string
  team2_flag: string
  team1_logo: string | null
  team2_logo: string | null
  group_name: string | null
  round: string
  status_short: string | null
  is_final: boolean
}

type PredictionRow = {
  match_id: string
  pred_team1: number
  pred_team2: number
  advance_pick: number | null
}

type ScoreInput = {
  score1: string
  score2: string
}

type MatchGroupId = KnockoutRoundId | `group-${string}` | `matchday-${string}`

type MatchGroup = {
  id: MatchGroupId
  title: string
  subtitle?: string
  matches: Match[]
}

function isClassicMatchDirty(
  match: Match,
  scores: Record<string, ScoreInput>,
  baselineScores: Record<string, ScoreInput>,
  advancePicks: Record<string, number | null>,
  baselineAdvancePicks: Record<string, number | null>,
): boolean {
  if (isMatchLocked(match.locked_at)) return false

  const entry = scores[match.id]
  const baseline = baselineScores[match.id]
  const score1Empty = !entry || entry.score1 === ''
  const score2Empty = !entry || entry.score2 === ''

  if (score1Empty && score2Empty) {
    return Boolean(baseline?.score1 && baseline?.score2)
  }

  if (score1Empty !== score2Empty) return false

  const scoreChanged =
    entry!.score1 !== (baseline?.score1 ?? '') ||
    entry!.score2 !== (baseline?.score2 ?? '')

  if (isKnockoutRound(match.round)) {
    const predTeam1 = parseScoreValue(entry!.score1)
    const predTeam2 = parseScoreValue(entry!.score2)
    if (predTeam1 == null || predTeam2 == null) return false
    const effectiveAdvance = resolveAdvancePickFromScores(
      predTeam1,
      predTeam2,
      advancePicks[match.id],
    )
    const baselineAdvance = resolveAdvancePickFromScores(
      predTeam1,
      predTeam2,
      baselineAdvancePicks[match.id],
    )
    return scoreChanged || effectiveAdvance !== baselineAdvance
  }

  return scoreChanged
}

function clampScoreValue(value: string): string {
  if (value === '') return ''
  const num = Number.parseInt(value, 10)
  if (Number.isNaN(num)) return ''
  return String(Math.min(20, Math.max(0, num)))
}

function parseScoreValue(value: string): number | null {
  if (value === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function isClassicMatchComplete(
  match: Match,
  entry: ScoreInput | undefined,
  _advancePick?: number | null,
): boolean {
  if (!entry || !hasClassicPredictionScores(entry.score1, entry.score2)) {
    return false
  }
  return true
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function buildMatchdayGroups(matches: Match[]): MatchGroup[] {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
  )
  const dayKeys: string[] = []
  for (const m of sorted) {
    const day = m.kickoff_at.slice(0, 10)
    if (!dayKeys.includes(day)) dayKeys.push(day)
  }

  return dayKeys.map((day, index) => {
    const dayMatches = sorted.filter((m) => m.kickoff_at.startsWith(day))
    return {
      id: `matchday-${day}`,
      title: `MATCHDAY ${index + 1}`,
      subtitle: formatShortDate(day),
      matches: dayMatches,
    }
  })
}

function buildGroupStageSections(matches: Match[]): MatchGroup[] {
  const byGroup = new Map<string, Match[]>()
  for (const m of matches) {
    const key = m.group_name?.toUpperCase() ?? 'OTHER'
    if (!byGroup.has(key)) byGroup.set(key, [])
    byGroup.get(key)!.push(m)
  }
  if (byGroup.size > 1 && [...byGroup.keys()].some((k) => k !== 'OTHER')) {
    return [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, groupMatches]) => ({
        id: `group-${group}`,
        title: `GROUP ${group}`,
        matches: groupMatches.sort(
          (a, b) =>
            new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
        ),
      }))
  }
  return buildMatchdayGroups(matches)
}

function toSectionMatch(
  match: Match,
  scores: Record<string, ScoreInput>,
  baselineScores: Record<string, ScoreInput>,
  savedMatchIds: Set<string>,
  advancePicks: Record<string, number | null>,
  baselineAdvancePicks: Record<string, number | null>,
): SectionMatch {
  const entry = scores[match.id] ?? { score1: '', score2: '' }
  const complete = isClassicMatchComplete(match, entry, advancePicks[match.id])
  const dirty = isClassicMatchDirty(
    match,
    scores,
    baselineScores,
    advancePicks,
    baselineAdvancePicks,
  )
  return {
    id: match.id,
    homeTeam: {
      name: match.team1_name,
      flag: resolveTeamFlag(match.team1_name, match.team1_flag),
      dbFlag: match.team1_flag,
      logoUrl: match.team1_logo,
    },
    awayTeam: {
      name: match.team2_name,
      flag: resolveTeamFlag(match.team2_name, match.team2_flag),
      dbFlag: match.team2_flag,
      logoUrl: match.team2_logo,
    },
    homeScore: entry.score1,
    awayScore: entry.score2,
    kickoffAt: match.kickoff_at,
    statusNote: getVoidMatchStatusLabel(match.status_short),
    isLocked: isMatchLocked(match.locked_at),
    isPredicted: savedMatchIds.has(match.id) && complete && !dirty,
  }
}

function sectionNeedsAttention(
  group: MatchGroup,
  scores: Record<string, ScoreInput>,
  advancePicks: Record<string, number | null>,
): boolean {
  return group.matches.some(
    (m) =>
      !isMatchLocked(m.locked_at) &&
      !isClassicMatchComplete(m, scores[m.id], advancePicks[m.id]),
  )
}

function allClassicPredictionsComplete(
  matches: Match[],
  scores: Record<string, ScoreInput>,
  advancePicks: Record<string, number | null>,
): boolean {
  if (matches.length === 0) return false

  return matches.every((match) => {
    if (isMatchLocked(match.locked_at)) return true
    return isClassicMatchComplete(match, scores[match.id], advancePicks[match.id])
  })
}

function ClassicKnockoutPredictCard({
  match,
  card,
  advancePick,
  onAdvancePick,
  onHomeScoreChange,
  onAwayScoreChange,
  variant = 'compact',
}: {
  match: Match
  card: SectionMatch
  advancePick: number | null
  onAdvancePick: (pick: 1 | 2) => void
  onHomeScoreChange: (value: string) => void
  onAwayScoreChange: (value: string) => void
  variant?: 'compact' | 'prominent'
}) {
  const predTeam1 = parseScoreValue(card.homeScore)
  const predTeam2 = parseScoreValue(card.awayScore)

  return (
    <div className="overflow-hidden rounded-xl border border-border/90 bg-card/40">
      <CompactMatchRow
        variant={variant}
        homeTeam={card.homeTeam}
        awayTeam={card.awayTeam}
        homeScore={card.homeScore}
        awayScore={card.awayScore}
        kickoffAt={card.kickoffAt}
        statusNote={card.statusNote}
        isLocked={card.isLocked}
        isPredicted={card.isPredicted}
        onHomeScoreChange={onHomeScoreChange}
        onAwayScoreChange={onAwayScoreChange}
      />
      <div className="space-y-2 px-3 pb-3">
        <KnockoutAdvancePicker
          team1Name={match.team1_name}
          team2Name={match.team2_name}
          team1Flag={match.team1_flag}
          team2Flag={match.team2_flag}
          team1Logo={match.team1_logo}
          team2Logo={match.team2_logo}
          predTeam1={predTeam1}
          predTeam2={predTeam2}
          userAdvancePick={advancePick}
          round={match.round}
          isLocked={card.isLocked}
          onAdvancePick={card.isLocked ? undefined : onAdvancePick}
        />
      </div>
    </div>
  )
}

function ClassicThirdPlaceTbdCard() {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        3rd Place Playoff
      </p>
      <div className="overflow-hidden rounded-xl border border-border/90 bg-card/40 px-4 py-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          3rd Place
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">
          To be decided
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          This pick unlocks once the official fixture is published.
        </p>
      </div>
    </section>
  )
}

export default function PredictPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.invite_code as string
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const [pool, setPool] = useState<Pool | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [scores, setScores] = useState<Record<string, ScoreInput>>({})
  const [baselineScores, setBaselineScores] = useState<Record<string, ScoreInput>>({})
  const [advancePicks, setAdvancePicks] = useState<Record<string, number | null>>({})
  const [baselineAdvancePicks, setBaselineAdvancePicks] = useState<
    Record<string, number | null>
  >({})
  const [savedMatchIds, setSavedMatchIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<ClassicRoundTabId>('group')
  const [seasonPlayoffPhase, setSeasonPlayoffPhase] =
    useState<SeasonPlayoffPhaseId>('season')
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveBarError, setSaveBarError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const predictionsCompletedTrackedRef = useRef(false)

  const loadData = useCallback(async () => {
    if (!userId) return

    setPageLoading(true)
    setError(null)

    const { data: poolData, error: poolError } = await supabase
      .from('pools')
      .select('id, name, invite_code, scoring_style, event_id')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    // Unreadable under pools_read (private non-member / bad code) → join flow.
    if (poolError || !poolData) {
      router.replace(`/join/${encodeURIComponent(inviteCode)}`)
      return
    }

    const { data: memberData, error: memberError } = await supabase
      .from('pool_members')
      .select('id')
      .eq('pool_id', poolData.id)
      .eq('user_id', userId)
      .maybeSingle()

    // Readable pool (e.g. public) but user hasn't joined — join before predict.
    if (memberError || !memberData) {
      router.replace(`/join/${encodeURIComponent(inviteCode)}`)
      return
    }

    let matchesQuery = supabase
      .from('matches')
      .select(
        'id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, team1_logo, team2_logo, group_name, round, status_short, is_final',
      )
      .order('kickoff_at', { ascending: true })
    if (poolData.event_id) {
      matchesQuery = matchesQuery.eq('event_id', poolData.event_id)
    }
    const { data: matchesData, error: matchesError } = await matchesQuery

    if (matchesError) {
      console.error('Failed to load matches:', matchesError.message)
      setError('Failed to load matches')
    }

    const { data: predictionsData, error: predictionsError } = await supabase
      .from('predictions')
      .select('match_id, pred_team1, pred_team2, advance_pick')
      .eq('pool_id', poolData.id)
      .eq('member_id', memberData.id)

    if (predictionsError) {
      console.error('Failed to load predictions:', predictionsError.message)
      setError('Failed to load predictions')
    }

    const isWinnerOnlyPool = (poolData as Pool).scoring_style === 'winner'
    const initialScores: Record<string, ScoreInput> = {}
    const initialAdvancePicks: Record<string, number | null> = {}
    const initialSaved = new Set<string>()

    for (const match of (matchesData ?? []) as Match[]) {
      initialScores[match.id] = { score1: '', score2: '' }
      initialAdvancePicks[match.id] = null
    }

    if (!isWinnerOnlyPool) {
      for (const prediction of (predictionsData ?? []) as PredictionRow[]) {
        initialScores[prediction.match_id] = {
          score1: String(prediction.pred_team1),
          score2: String(prediction.pred_team2),
        }
        const pick =
          prediction.advance_pick === 1 || prediction.advance_pick === 2
            ? prediction.advance_pick
            : null
        initialAdvancePicks[prediction.match_id] = pick
        initialSaved.add(prediction.match_id)
      }
    }

    const loaded = (matchesData ?? []) as Match[]
    const defaultTab = resolveDefaultClassicRoundTab(loaded, (match) =>
      !isMatchLocked(match.locked_at) &&
      !isClassicMatchComplete(
        match,
        initialScores[match.id],
        initialAdvancePicks[match.id],
      ),
    )

    setPool(poolData as Pool)
    setMemberId(memberData.id)
    setMatches(loaded)
    setScores(initialScores)
    setBaselineScores(
      Object.fromEntries(
        Object.entries(initialScores).map(([id, s]) => [id, { ...s }]),
      ),
    )
    setAdvancePicks(initialAdvancePicks)
    setBaselineAdvancePicks({ ...initialAdvancePicks })
    setSavedMatchIds(initialSaved)
    setActiveTab(defaultTab)
    setSeasonPlayoffPhase(
      !isTournamentStyleMatches(loaded) &&
        hasMlsPlayoffRounds(loaded) &&
        !loaded.some((match) => isSeasonFlatRound(match.round))
        ? 'playoffs'
        : 'season',
    )
    setPageLoading(false)
  }, [inviteCode, router, userId])

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      router.replace('/login')
      return
    }
    loadData()
  }, [authLoading, userId, router, loadData])

  const tournamentMode = useMemo(
    () => matches.length > 0 && isTournamentStyleMatches(matches),
    [matches],
  )
  const mixedPlayoffMode = useMemo(
    () =>
      matches.length > 0 &&
      !tournamentMode &&
      hasMlsPlayoffRounds(matches),
    [matches, tournamentMode],
  )
  const seasonMode = useMemo(
    () => matches.length > 0 && !tournamentMode && !mixedPlayoffMode,
    [matches, mixedPlayoffMode, tournamentMode],
  )

  const tabMatches = useMemo(() => {
    if (seasonMode) {
      return [...matches].sort(
        (a, b) =>
          new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
      )
    }
    if (mixedPlayoffMode) {
      const filtered =
        seasonPlayoffPhase === 'playoffs'
          ? matches.filter((match) => isMlsPlayoffRound(match.round))
          : matches.filter((match) => isSeasonFlatRound(match.round))
      return [...filtered].sort(
        (a, b) =>
          new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
      )
    }
    return matches.filter((m) => matchInClassicRoundTab(m.round, activeTab))
  }, [
    activeTab,
    matches,
    mixedPlayoffMode,
    seasonMode,
    seasonPlayoffPhase,
  ])

  const sections = useMemo(() => {
    if (seasonMode || mixedPlayoffMode || activeTab !== 'group') return []
    return buildGroupStageSections(tabMatches)
  }, [tabMatches, activeTab, mixedPlayoffMode, seasonMode])

  const defaultOpenSectionId = useMemo(() => {
    const open =
      sections.find((s) => sectionNeedsAttention(s, scores, advancePicks))?.id ??
      sections[0]?.id
    return open ?? ''
  }, [sections, scores, advancePicks])

  const predictedCount = useMemo(
    () =>
      matches.filter((match) =>
        isClassicMatchComplete(match, scores[match.id], advancePicks[match.id]),
      ).length,
    [matches, scores, advancePicks],
  )

  const tabPredictedCount = useMemo(
    () =>
      tabMatches.filter((m) =>
        isClassicMatchComplete(m, scores[m.id], advancePicks[m.id]),
      ).length,
    [tabMatches, scores, advancePicks],
  )

  const totalMatches = classicMatchTotalCount(matches.length)

  const lifecycleBuckets = useMemo(
    () =>
      partitionByLifecycleSection(tabMatches, (match) =>
        getMatchLifecycleSection(match),
      ),
    [tabMatches],
  )

  const unsavedCount = useMemo(() => {
    return tabMatches.filter((match) =>
      isClassicMatchDirty(
        match,
        scores,
        baselineScores,
        advancePicks,
        baselineAdvancePicks,
      ),
    ).length
  }, [tabMatches, scores, baselineScores, advancePicks, baselineAdvancePicks])

  const dismissSuccessToast = useCallback(() => {
    setSuccessMessage(null)
  }, [])

  function updateScore(matchId: string, field: 'score1' | 'score2', value: string) {
    const match = matches.find((row) => row.id === matchId)
    const sanitized = value.replace(/\D/g, '')
    const clamped = clampScoreValue(sanitized)
    const current = scores[matchId] ?? { score1: '', score2: '' }
    const nextScore1 = field === 'score1' ? clamped : current.score1
    const nextScore2 = field === 'score2' ? clamped : current.score2

    setSaveSuccess(false)
    setSaveBarError(null)
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        score1: nextScore1,
        score2: nextScore2,
      },
    }))

    if (match && isKnockoutRound(match.round)) {
      const predTeam1 = parseScoreValue(nextScore1)
      const predTeam2 = parseScoreValue(nextScore2)
      if (predTeam1 != null && predTeam2 != null) {
        setAdvancePicks((prev) => ({
          ...prev,
          [matchId]: !isPredictedDraw(predTeam1, predTeam2)
            ? predTeam1 > predTeam2
              ? 1
              : 2
            : null,
        }))
      }
    }

    setSuccessMessage(null)
  }

  function updateAdvancePick(matchId: string, pick: 1 | 2) {
    const match = matches.find((row) => row.id === matchId)
    if (!match || !isKnockoutRound(match.round) || isMatchLocked(match.locked_at)) {
      return
    }

    const entry = scores[matchId]
    const predTeam1 = parseScoreValue(entry?.score1 ?? '')
    const predTeam2 = parseScoreValue(entry?.score2 ?? '')
    if (
      predTeam1 == null ||
      predTeam2 == null ||
      !isPredictedDraw(predTeam1, predTeam2)
    ) {
      return
    }

    setSaveSuccess(false)
    setSaveBarError(null)
    setAdvancePicks((prev) => ({ ...prev, [matchId]: pick }))
    setSuccessMessage(null)
  }

  async function handleSave() {
    if (!pool || !memberId || unsavedCount === 0) return

    setSaving(true)
    setSuccessMessage(null)
    setSaveSuccess(false)
    setSaveBarError(null)

    const changedMatches = tabMatches.filter((match) =>
      isClassicMatchDirty(
        match,
        scores,
        baselineScores,
        advancePicks,
        baselineAdvancePicks,
      ),
    )

    if (changedMatches.length === 0) {
      setSaving(false)
      return
    }

    let savedCount = 0
    let lockedCount = 0
    let errorCount = 0

    for (const match of changedMatches) {
      if (isMatchLocked(match.locked_at)) {
        lockedCount += 1
        continue
      }

      const entry = scores[match.id]
      const bothEmpty = !entry || (entry.score1 === '' && entry.score2 === '')

      if (bothEmpty) {
        const result = await deletePoolMatchPrediction(supabase, {
          poolId: pool.id,
          memberId,
          matchId: match.id,
        })

        if (!result.ok) {
          if (result.isLockViolation) lockedCount += 1
          else errorCount += 1
          continue
        }

        setSavedMatchIds((prev) => {
          const next = new Set(prev)
          next.delete(match.id)
          return next
        })
        setBaselineScores((prev) => {
          const next = { ...prev }
          delete next[match.id]
          return next
        })
        setBaselineAdvancePicks((prev) => {
          const next = { ...prev }
          delete next[match.id]
          return next
        })
        savedCount += 1
        continue
      }

      if (!entry || entry.score1 === '' || entry.score2 === '') {
        continue
      }

      const predTeam1 = Number.parseInt(entry.score1, 10)
      const predTeam2 = Number.parseInt(entry.score2, 10)
      const advancePick = isKnockoutRound(match.round)
        ? resolveAdvancePickFromScores(
            predTeam1,
            predTeam2,
            advancePicks[match.id],
          )
        : undefined

      const hadPrior = savedMatchIds.has(match.id)

      const result = await upsertPoolMatchPrediction(supabase, {
        poolId: pool.id,
        memberId,
        matchId: match.id,
        predTeam1,
        predTeam2,
        advancePick,
      })

      if (!result.ok) {
        if (result.isLockViolation) lockedCount += 1
        else errorCount += 1
        continue
      }

      setSavedMatchIds((prev) => new Set(prev).add(match.id))
      setBaselineScores((prev) => ({
        ...prev,
        [match.id]: { ...entry },
      }))
      if (isKnockoutRound(match.round)) {
        setBaselineAdvancePicks((prev) => ({
          ...prev,
          [match.id]: advancePick ?? null,
        }))
      }
      savedCount += 1
      capturePostHog(
        hadPrior ? 'prediction_edited' : 'prediction_submitted',
        {
          pool_id: pool.id,
          match_id: match.id,
        },
      )
      void import('@/components/push/push-nudge-host').then(
        ({ markFirstPredictionForPushNudge }) => {
          markFirstPredictionForPushNudge()
        },
      )
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

    if (
      allClassicPredictionsComplete(matches, scores, advancePicks) &&
      !predictionsCompletedTrackedRef.current
    ) {
      capturePostHog('predictions_completed', { pool_id: pool.id })
      predictionsCompletedTrackedRef.current = true
    }

    setSaveSuccess(true)
    setSuccessMessage(
      `Saved ${savedCount} prediction${savedCount === 1 ? '' : 's'}`,
    )
    window.setTimeout(() => setSaveSuccess(false), 2000)
  }

  useEffect(() => {
    if (!pageLoading && pool?.scoring_style === 'winner') {
      router.replace(`/pool/${inviteCode}?tab=predictions`)
    }
  }, [pageLoading, pool, inviteCode, router])

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (pageLoading || !pool) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">
          {pageLoading ? 'Loading matches…' : 'Taking you to join…'}
        </p>
      </div>
    )
  }

  if (pool.scoring_style === 'winner') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Redirecting…</p>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen bg-background', SAVE_BAR_SOLO_SCROLL_PAD_CLASS)}>
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/pool/${inviteCode}`}
              className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">{pool.name}</span>
            </Link>
            <ReportIssueButton />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="font-display text-3xl tracking-wide text-foreground uppercase sm:text-4xl">
              Predictions
            </h1>
            <p className="font-mono text-xs text-muted-foreground sm:text-sm">
              {tabPredictedCount}/{tabMatches.length} in this view
            </p>
          </div>

          <ProgressHeader current={predictedCount} total={totalMatches} />

          {seasonMode ? null : mixedPlayoffMode ? (
            <SeasonPlayoffTabs
              activeId={seasonPlayoffPhase}
              onChange={setSeasonPlayoffPhase}
            />
          ) : (
            <ClassicRoundTabs activeId={activeTab} onChange={setActiveTab} />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {error && (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            <p>{error}</p>
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              onClick={() => void loadData()}
            >
              Try again
            </button>
          </div>
        )}

        {tabMatches.length === 0 && !error ? (
          seasonMode ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No matches scheduled yet.
            </p>
          ) : mixedPlayoffMode && seasonPlayoffPhase === 'season' ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No regular-season matches scheduled yet.
            </p>
          ) : mixedPlayoffMode && seasonPlayoffPhase === 'playoffs' ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No playoff matches scheduled yet.
            </p>
          ) : activeTab === 'r32' ? (
            <ClassicR32PreviewTab />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {classicRoundTabEmptyMessage(activeTab)}
            </p>
          )
        ) : mixedPlayoffMode && seasonPlayoffPhase === 'playoffs' ? (
          <MlsPlayoffStageSections
            items={tabMatches}
            getKickoffMs={(match) => new Date(match.kickoff_at).getTime()}
            getKey={(match) => match.id}
            renderMatch={(match) => {
              const card = toSectionMatch(
                match,
                scores,
                baselineScores,
                savedMatchIds,
                advancePicks,
                baselineAdvancePicks,
              )
              return (
                <ClassicKnockoutPredictCard
                  match={match}
                  card={card}
                  advancePick={advancePicks[match.id] ?? null}
                  onAdvancePick={(pick) => updateAdvancePick(match.id, pick)}
                  onHomeScoreChange={(v) => updateScore(match.id, 'score1', v)}
                  onAwayScoreChange={(v) => updateScore(match.id, 'score2', v)}
                />
              )
            }}
          />
        ) : (
          <div
            key={
              seasonMode
                ? 'season'
                : mixedPlayoffMode
                  ? seasonPlayoffPhase
                  : activeTab
            }
            className="space-y-6"
          >
            {MATCH_LIFECYCLE_SECTION_ORDER.filter(
              (sectionId) => lifecycleBuckets[sectionId].length > 0,
            ).map((sectionId) => {
              const sectionMatches = lifecycleBuckets[sectionId]
              const useGroupSections =
                !seasonMode && !mixedPlayoffMode && activeTab === 'group'
              const groupSections = useGroupSections
                ? buildGroupStageSections(sectionMatches)
                : []

              return (
                <section
                  key={sectionId}
                  aria-label={sectionId}
                  className="space-y-3"
                >
                  <MatchLifecycleSectionHeader
                    sectionId={sectionId}
                    count={sectionMatches.length}
                  />

                  {useGroupSections ? (
                    groupSections.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No matches in this section.
                      </p>
                    ) : (
                      groupSections.map((group) => (
                        <MatchSection
                          key={`${sectionId}-${group.id}`}
                          id={`${sectionId}-${group.id}`}
                          title={group.title}
                          subtitle={group.subtitle}
                          matches={group.matches.map((m) =>
                            toSectionMatch(
                              m,
                              scores,
                              baselineScores,
                              savedMatchIds,
                              advancePicks,
                              baselineAdvancePicks,
                            ),
                          )}
                          predictedInSection={
                            group.matches.filter((m) =>
                              isClassicMatchComplete(
                                m,
                                scores[m.id],
                                advancePicks[m.id],
                              ),
                            ).length
                          }
                          defaultOpen={
                            sectionId !== 'completed' &&
                            group.id === defaultOpenSectionId
                          }
                          onHomeScoreChange={(id, v) =>
                            updateScore(id, 'score1', v)
                          }
                          onAwayScoreChange={(id, v) =>
                            updateScore(id, 'score2', v)
                          }
                        />
                      ))
                    )
                  ) : (
                    <div className="flex flex-col gap-3">
                      {(seasonMode ||
                      mixedPlayoffMode ||
                      activeTab !== 'final'
                        ? sectionMatches
                        : sectionMatches.filter(
                            (match) =>
                              match.round === 'final' ||
                              match.round === 'third',
                          )
                      ).map((match) => {
                        const card = toSectionMatch(
                          match,
                          scores,
                          baselineScores,
                          savedMatchIds,
                          advancePicks,
                          baselineAdvancePicks,
                        )
                        if (!seasonMode && !mixedPlayoffMode && match.round === 'third') {
                          return (
                            <section key={match.id} className="space-y-2">
                              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                3rd Place Playoff
                              </p>
                              <ClassicKnockoutPredictCard
                                match={match}
                                card={card}
                                advancePick={advancePicks[match.id] ?? null}
                                onAdvancePick={(pick) =>
                                  updateAdvancePick(match.id, pick)
                                }
                                onHomeScoreChange={(v) =>
                                  updateScore(match.id, 'score1', v)
                                }
                                onAwayScoreChange={(v) =>
                                  updateScore(match.id, 'score2', v)
                                }
                              />
                            </section>
                          )
                        }
                        return (
                          <ClassicKnockoutPredictCard
                            key={match.id}
                            match={match}
                            card={card}
                            advancePick={advancePicks[match.id] ?? null}
                            onAdvancePick={(pick) =>
                              updateAdvancePick(match.id, pick)
                            }
                            onHomeScoreChange={(v) =>
                              updateScore(match.id, 'score1', v)
                            }
                            onAwayScoreChange={(v) =>
                              updateScore(match.id, 'score2', v)
                            }
                          />
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
            {!seasonMode &&
            !mixedPlayoffMode &&
            activeTab === 'final' &&
            !tabMatches.some((match) => match.round === 'third') ? (
              <ClassicThirdPlaceTbdCard />
            ) : null}
          </div>
        )}
      </main>

      <SaveBar
        unsavedCount={unsavedCount}
        saving={saving}
        success={saveSuccess}
        error={saveBarError}
        disabled={unsavedCount === 0}
        stackAboveMobileNav={false}
        onSave={handleSave}
      />

      <SaveSuccessToast
        message={successMessage}
        onDismiss={dismissSuccessToast}
      />
    </div>
  )
}
