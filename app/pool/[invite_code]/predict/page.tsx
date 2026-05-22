'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'

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

function formatMatchDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

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

export default function PredictPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.invite_code as string
  const { user, loading: authLoading } = useAuth()

  const [pool, setPool] = useState<Pool | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [scores, setScores] = useState<Record<string, ScoreInput>>({})
  const [savedMatchIds, setSavedMatchIds] = useState<Set<string>>(new Set())
  const [pageLoading, setPageLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [notMember, setNotMember] = useState(false)
  const [saving, setSaving] = useState(false)
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
        'id, kickoff_at, locked_at, team1_name, team2_name, team1_flag, team2_flag'
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

    setPool(poolData as Pool)
    setMemberId(memberData.id)
    setMatches((matchesData ?? []) as Match[])
    setScores(initialScores)
    setSavedMatchIds(initialSaved)
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

  const matchesByDate = useMemo(() => {
    return matches.reduce<Record<string, Match[]>>((groups, match) => {
      const dateKey = formatMatchDate(match.kickoff_at)
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(match)
      return groups
    }, {})
  }, [matches])

  function updateScore(
    matchId: string,
    field: 'score1' | 'score2',
    value: string
  ) {
    const sanitized = value.replace(/\D/g, '')
    const clamped = clampScoreValue(sanitized)

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
    if (!pool || !memberId) return

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

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
    setSuccessMessage(`Saved ${rows.length} prediction${rows.length === 1 ? '' : 's'}`)
  }

  if (authLoading || (!user && !notFound)) {
    return (
      <main className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <p className="text-[#5a7080]">Loading…</p>
      </main>
    )
  }

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <p className="text-[#5a7080]">Loading matches…</p>
      </main>
    )
  }

  if (notFound || !pool) {
    return (
      <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-8 text-center">
          <p className="text-lg font-semibold text-[#f0f4f8]">Pool not found</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block text-sm text-[#00e676] hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    )
  }

  if (notMember) {
    return (
      <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-8 text-center">
          <p className="text-lg font-semibold text-[#f0f4f8]">Join this pool first</p>
          <p className="mt-2 text-sm text-[#5a7080]">
            You need to be a member before making predictions.
          </p>
          <Link
            href={`/join/${inviteCode}`}
            className="mt-6 inline-block rounded-lg bg-[#00e676] px-5 py-3 text-sm font-semibold text-[#080b0f]"
          >
            Join pool
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b0f] pb-28 pt-8">
      <div className="mx-auto w-full max-w-lg px-4">
        <Link
          href={`/pool/${inviteCode}`}
          className="text-sm text-[#5a7080] hover:text-[#00e676] transition-colors"
        >
          ← Back to pool
        </Link>

        <header className="mt-4 mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-wide text-[#f0f4f8]">
              Your predictions
            </h1>
            <p className="mt-1 text-sm text-[#5a7080]">{pool.name}</p>
          </div>
        </header>

        {successMessage && (
          <div className="mb-4 rounded-lg border border-[#00e676]/30 bg-[#00e676]/10 px-4 py-3 text-sm text-[#00e676]">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(matchesByDate).map(([dateLabel, dayMatches]) => (
            <section key={dateLabel}>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#5a7080]">
                {dateLabel}
              </h2>
              <div className="space-y-3">
                {dayMatches.map((match) => {
                  const locked = isMatchLocked(match.locked_at)
                  const entry = scores[match.id] ?? { score1: '', score2: '' }
                  const hasSaved = savedMatchIds.has(match.id)
                  const bothFilled = entry.score1 !== '' && entry.score2 !== ''

                  return (
                    <div
                      key={match.id}
                      className={`rounded-xl border border-[#1e2d3d] bg-[#111a27] p-4 ${
                        locked ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="text-2xl">{match.team1_flag}</span>
                          <span className="truncate text-sm font-medium text-[#f0f4f8]">
                            {match.team1_name}
                          </span>
                        </div>

                        {locked ? (
                          <span className="shrink-0 rounded-lg bg-[#1a2535] px-3 py-2 text-xs font-semibold tracking-wider text-[#5a7080]">
                            LOCKED
                          </span>
                        ) : (
                          <div className="flex shrink-0 items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={20}
                              inputMode="numeric"
                              placeholder="–"
                              value={entry.score1}
                              onChange={(e) =>
                                updateScore(match.id, 'score1', e.target.value)
                              }
                              className={`h-11 w-12 rounded-md text-center font-display text-xl focus:outline-none focus:ring-2 focus:ring-[#00e676] ${
                                hasSaved && bothFilled
                                  ? 'border-2 border-[#00e676] bg-[#00e676]/15 text-[#00e676]'
                                  : 'border border-[#1e2d3d] bg-[#080b0f] text-[#f0f4f8]'
                              }`}
                            />
                            <span className="text-[#5a7080]">–</span>
                            <input
                              type="number"
                              min={0}
                              max={20}
                              inputMode="numeric"
                              placeholder="–"
                              value={entry.score2}
                              onChange={(e) =>
                                updateScore(match.id, 'score2', e.target.value)
                              }
                              className={`h-11 w-12 rounded-md text-center font-display text-xl focus:outline-none focus:ring-2 focus:ring-[#00e676] ${
                                hasSaved && bothFilled
                                  ? 'border-2 border-[#00e676] bg-[#00e676]/15 text-[#00e676]'
                                  : 'border border-[#1e2d3d] bg-[#080b0f] text-[#f0f4f8]'
                              }`}
                            />
                            {hasSaved && bothFilled && (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00e676]">
                                <svg
                                  className="h-3.5 w-3.5 text-[#080b0f]"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                          <span className="truncate text-sm font-medium text-[#f0f4f8]">
                            {match.team2_name}
                          </span>
                          <span className="text-2xl">{match.team2_flag}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          {matches.length === 0 && (
            <p className="text-center text-sm text-[#5a7080]">
              No matches available yet.
            </p>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-[#1e2d3d] bg-[#111a27] p-4">
        <div className="mx-auto w-full max-w-lg">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00e676] py-4 text-base font-semibold text-[#080b0f] hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save predictions'}
          </button>
        </div>
      </div>
    </main>
  )
}
