'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'
import { CompactMatchRow } from '@/components/predict/compact-match-row'
import { MatchSection, type SectionMatch } from '@/components/predict/match-section'
import { StageTabs, type StageTab } from '@/components/predict/stage-tabs'
import { ProgressHeader } from '@/components/predict/progress-header'
import { SaveBar } from '@/components/predict/save-bar'

type Pool = {
  id: string
  name: string
  invite_code: string
}

type Match = {
  id: string
  kickoff_at: string
  locked_at: string | null
  team1_name: string
  team2_name: string
  team1_flag: string
  team2_flag: string
  group_name: string | null
  round: string
}

type PredictionRow = {
  match_id: string
  pred_team1: number
  pred_team2: number
}

type ScoreInput = {
  score1: string
  score2: string
}

type MatchGroup = {
  id: string
  title: string
  subtitle?: string
  matches: Match[]
}

const STAGE_TABS: StageTab[] = [
  { id: 'group', label: 'Group Stage' },
  { id: 'knockout', label: 'Round of 16' },
  { id: 'qf', label: 'Quarter Finals' },
  { id: 'sf', label: 'Semi Finals' },
  { id: 'final', label: 'Final' },
]

const STAGE_ROUNDS: Record<string, string[]> = {
  group: ['group'],
  knockout: ['r32', 'r16'],
  qf: ['qf'],
  sf: ['sf'],
  final: ['final'],
}

const KNOCKOUT_SECTION_LABELS: Record<string, string> = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter Finals',
  sf: 'Semi Finals',
  final: 'Final',
}

const KNOCKOUT_SECTION_ORDER = ['r32', 'r16', 'qf', 'sf', 'final'] as const

function isMatchLocked(lockedAt: string | null): boolean {
  if (!lockedAt) return false
  return new Date(lockedAt).getTime() <= Date.now()
}

function clampScoreValue(value: string): string {
  if (value === '') return ''
  const num = Number.parseInt(value, 10)
  if (Number.isNaN(num)) return ''
  return String(Math.min(20, Math.max(0, num)))
}

function isPredicted(match: Match, scores: Record<string, ScoreInput>): boolean {
  const entry = scores[match.id]
  return entry?.score1 !== '' && entry?.score2 !== ''
}

function matchInStage(match: Match, stageId: string): boolean {
  return STAGE_ROUNDS[stageId]?.includes(match.round) ?? false
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

function buildKnockoutGroups(matches: Match[], stageId: string): MatchGroup[] {
  const rounds = STAGE_ROUNDS[stageId] ?? []
  return KNOCKOUT_SECTION_ORDER.filter((r) => rounds.includes(r))
    .map((round) => {
      const roundMatches = matches
        .filter((m) => m.round === round)
        .sort(
          (a, b) =>
            new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
        )
      if (roundMatches.length === 0) return null
      return {
        id: round,
        title: KNOCKOUT_SECTION_LABELS[round].toUpperCase(),
        subtitle: formatShortDate(roundMatches[0].kickoff_at),
        matches: roundMatches,
      }
    })
    .filter((g): g is MatchGroup => g !== null)
}

function buildGroupSections(matches: Match[], stageId: string): MatchGroup[] {
  if (stageId === 'group') {
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
  return buildKnockoutGroups(matches, stageId)
}

function toSectionMatch(
  match: Match,
  scores: Record<string, ScoreInput>,
  savedMatchIds: Set<string>,
): SectionMatch {
  const entry = scores[match.id] ?? { score1: '', score2: '' }
  const both = entry.score1 !== '' && entry.score2 !== ''
  return {
    id: match.id,
    homeTeam: { name: match.team1_name, flag: match.team1_flag },
    awayTeam: { name: match.team2_name, flag: match.team2_flag },
    homeScore: entry.score1,
    awayScore: entry.score2,
    isLocked: isMatchLocked(match.locked_at),
    isPredicted: savedMatchIds.has(match.id) && both,
  }
}

function sectionNeedsAttention(
  group: MatchGroup,
  scores: Record<string, ScoreInput>,
): boolean {
  return group.matches.some(
    (m) => !isMatchLocked(m.locked_at) && !isPredicted(m, scores),
  )
}

export default function PredictPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.invite_code as string
  const { user, loading: authLoading } = useAuth()

  const [pool, setPool] = useState<Pool | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [scores, setScores] = useState<Record<string, ScoreInput>>({})
  const [baselineScores, setBaselineScores] = useState<Record<string, ScoreInput>>({})
  const [savedMatchIds, setSavedMatchIds] = useState<Set<string>>(new Set())
  const [activeStage, setActiveStage] = useState('group')
  const [pageLoading, setPageLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [notMember, setNotMember] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return

    setPageLoading(true)
    setNotFound(false)
    setNotMember(false)
    setError(null)

    const { data: poolData, error: poolError } = await supabase
      .from('pools')
      .select('id, name, invite_code')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (poolError || !poolData) {
      setNotFound(true)
      setPageLoading(false)
      return
    }

    const { data: memberData, error: memberError } = await supabase
      .from('pool_members')
      .select('id')
      .eq('pool_id', poolData.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError || !memberData) {
      setPool(poolData as Pool)
      setNotMember(true)
      setPageLoading(false)
      return
    }

    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select(
        'id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag, group_name, round',
      )
      .order('kickoff_at', { ascending: true })

    if (matchesError) {
      console.error('Failed to load matches:', matchesError.message)
      setError('Failed to load matches')
    }

    const { data: predictionsData, error: predictionsError } = await supabase
      .from('predictions')
      .select('match_id, pred_team1, pred_team2')
      .eq('pool_id', poolData.id)
      .eq('member_id', memberData.id)

    if (predictionsError) {
      console.error('Failed to load predictions:', predictionsError.message)
    }

    const initialScores: Record<string, ScoreInput> = {}
    const initialSaved = new Set<string>()

    for (const match of (matchesData ?? []) as Match[]) {
      initialScores[match.id] = { score1: '', score2: '' }
    }

    for (const prediction of (predictionsData ?? []) as PredictionRow[]) {
      initialScores[prediction.match_id] = {
        score1: String(prediction.pred_team1),
        score2: String(prediction.pred_team2),
      }
      initialSaved.add(prediction.match_id)
    }

    const loaded = (matchesData ?? []) as Match[]
    const defaultStage =
      STAGE_TABS.find((tab) =>
        loaded.some(
          (m) =>
            matchInStage(m, tab.id) &&
            !isMatchLocked(m.locked_at) &&
            !isPredicted(m, initialScores),
        ),
      )?.id ??
      STAGE_TABS.find((tab) => loaded.some((m) => matchInStage(m, tab.id)))?.id ??
      'group'

    setPool(poolData as Pool)
    setMemberId(memberData.id)
    setMatches(loaded)
    setScores(initialScores)
    setBaselineScores(
      Object.fromEntries(
        Object.entries(initialScores).map(([id, s]) => [id, { ...s }]),
      ),
    )
    setSavedMatchIds(initialSaved)
    setActiveStage(defaultStage)
    setPageLoading(false)
  }, [inviteCode, user])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    loadData()
  }, [authLoading, user, router, loadData])

  const stageMatches = useMemo(
    () => matches.filter((m) => matchInStage(m, activeStage)),
    [matches, activeStage],
  )

  const sections = useMemo(
    () => buildGroupSections(stageMatches, activeStage),
    [stageMatches, activeStage],
  )

  const defaultOpenSectionId = useMemo(() => {
    const open =
      sections.find((s) => sectionNeedsAttention(s, scores))?.id ??
      sections[0]?.id
    return open ?? ''
  }, [sections, scores])

  const predictedCount = useMemo(
    () => matches.filter((m) => isPredicted(m, scores)).length,
    [matches, scores],
  )

  const stagePredictedCount = useMemo(
    () => stageMatches.filter((m) => isPredicted(m, scores)).length,
    [stageMatches, scores],
  )

  const totalMatches = matches.length

  const priorityMatches = useMemo(() => {
    return matches
      .filter(
        (m) =>
          !isMatchLocked(m.locked_at) &&
          !isPredicted(m, scores) &&
          new Date(m.kickoff_at).getTime() >= Date.now(),
      )
      .sort(
        (a, b) =>
          new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
      )
      .slice(0, 4)
  }, [matches, scores])

  const unsavedCount = useMemo(() => {
    return matches.filter((match) => {
      if (isMatchLocked(match.locked_at)) return false
      const entry = scores[match.id]
      const baseline = baselineScores[match.id]
      if (!entry || entry.score1 === '' || entry.score2 === '') return false
      return (
        entry.score1 !== (baseline?.score1 ?? '') ||
        entry.score2 !== (baseline?.score2 ?? '')
      )
    }).length
  }, [matches, scores, baselineScores])

  const visibleTabs = useMemo(
    () =>
      STAGE_TABS.filter((tab) => matches.some((m) => matchInStage(m, tab.id))),
    [matches],
  )

  function updateScore(matchId: string, field: 'score1' | 'score2', value: string) {
    const sanitized = value.replace(/\D/g, '')
    const clamped = clampScoreValue(sanitized)
    setSaveSuccess(false)
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        score1: prev[matchId]?.score1 ?? '',
        score2: prev[matchId]?.score2 ?? '',
        [field]: clamped,
      },
    }))
    setSuccessMessage(null)
  }

  async function handleSave() {
    if (!pool || !memberId || unsavedCount === 0) return

    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    setSaveSuccess(false)

    const rows = matches
      .filter((match) => {
        if (isMatchLocked(match.locked_at)) return false
        const entry = scores[match.id]
        return entry?.score1 !== '' && entry?.score2 !== ''
      })
      .map((match) => {
        const entry = scores[match.id]!
        return {
          pool_id: pool.id,
          member_id: memberId,
          match_id: match.id,
          pred_team1: Number.parseInt(entry.score1, 10),
          pred_team2: Number.parseInt(entry.score2, 10),
        }
      })

    if (rows.length === 0) {
      setSaving(false)
      setError('Fill in both scores for at least one unlocked match')
      return
    }

    const { error: upsertError } = await supabase
      .from('predictions')
      .upsert(rows, { onConflict: 'pool_id,member_id,match_id' })

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    setSavedMatchIds((prev) => {
      const next = new Set(prev)
      rows.forEach((row) => next.add(row.match_id))
      return next
    })
    setBaselineScores((prev) => {
      const next = { ...prev }
      rows.forEach((row) => {
        next[row.match_id] = { ...scores[row.match_id]! }
      })
      return next
    })
    setSaveSuccess(true)
    setSuccessMessage(`Saved ${rows.length} prediction${rows.length === 1 ? '' : 's'}`)
    window.setTimeout(() => setSaveSuccess(false), 2000)
  }

  if (authLoading || (!user && !notFound)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading matches…</p>
      </div>
    )
  }

  if (notFound || !pool) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Pool not found</p>
          <Link href="/dashboard" className="mt-6 inline-block text-sm text-primary hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (notMember) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Join this pool first</p>
          <Link
            href={`/join/${inviteCode}`}
            className="mt-6 inline-block rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Join pool
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-3 sm:py-4">
          <Link
            href={`/pool/${inviteCode}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="truncate">{pool.name}</span>
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="font-display text-3xl tracking-wide text-foreground uppercase sm:text-4xl">
              Predictions
            </h1>
            <p className="font-mono text-xs text-muted-foreground sm:text-sm">
              {stagePredictedCount}/{stageMatches.length} in this stage
            </p>
          </div>

          <ProgressHeader current={predictedCount} total={totalMatches || 48} />

          {visibleTabs.length > 0 && (
            <StageTabs
              tabs={visibleTabs}
              activeId={activeStage}
              onChange={setActiveStage}
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
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

        {priorityMatches.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-secondary" />
              <h2 className="font-display text-lg tracking-wide text-foreground uppercase">
                Up Next
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
              {priorityMatches.map((match) => {
                const card = toSectionMatch(match, scores, savedMatchIds)
                return (
                  <CompactMatchRow
                    key={`priority-${match.id}`}
                    homeTeam={card.homeTeam}
                    awayTeam={card.awayTeam}
                    homeScore={card.homeScore}
                    awayScore={card.awayScore}
                    isLocked={card.isLocked}
                    isPredicted={card.isPredicted}
                    onHomeScoreChange={(v) => updateScore(match.id, 'score1', v)}
                    onAwayScoreChange={(v) => updateScore(match.id, 'score2', v)}
                  />
                )
              })}
            </div>
          </section>
        )}

        <div key={activeStage} className="space-y-2">
          {sections.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No matches in this stage.
            </p>
          ) : (
            sections.map((group) => (
              <MatchSection
                key={group.id}
                id={group.id}
                title={group.title}
                subtitle={group.subtitle}
                matches={group.matches.map((m) =>
                  toSectionMatch(m, scores, savedMatchIds),
                )}
                predictedInSection={
                  group.matches.filter((m) => isPredicted(m, scores)).length
                }
                defaultOpen={group.id === defaultOpenSectionId}
                onHomeScoreChange={(id, v) => updateScore(id, 'score1', v)}
                onAwayScoreChange={(id, v) => updateScore(id, 'score2', v)}
              />
            ))
          )}
        </div>
      </main>

      <SaveBar
        unsavedCount={unsavedCount}
        saving={saving}
        success={saveSuccess}
        disabled={unsavedCount === 0}
        onSave={handleSave}
      />
    </div>
  )
}
