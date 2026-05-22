'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'

type Pool = {
  id: string
  name: string
  invite_code: string
}

type PoolMember = {
  id: string
  user_id: string
  display_name: string
  joined_at: string
}

type LeaderboardEntry = {
  rank: number
  prev_rank: number | null
  user_id: string
  display_name: string
  points: number
  correct_predictions: number
}

function getRankMovement(rank: number, prevRank: number | null): {
  label: string
  className: string
} {
  if (prevRank == null || prevRank <= 0) {
    return { label: '—', className: 'text-[#5a7080]' }
  }
  const delta = prevRank - rank
  if (delta > 0) {
    return { label: `↑${delta}`, className: 'text-[#00e676]' }
  }
  if (delta < 0) {
    return { label: `↓${Math.abs(delta)}`, className: 'text-[#ff4444]' }
  }
  return { label: '—', className: 'text-[#5a7080]' }
}

export default function PoolPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.invite_code as string
  const { user, loading: authLoading } = useAuth()

  const [pool, setPool] = useState<Pool | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadPoolData = useCallback(async () => {
    setPageLoading(true)
    setNotFound(false)

    const { data: poolData, error: poolError } = await supabase
      .from('pools')
      .select('id, name, invite_code')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (poolError || !poolData) {
      setPool(null)
      setLeaderboard([])
      setNotFound(true)
      setPageLoading(false)
      return
    }

    const { data: membersData, error: membersError } = await supabase
      .from('pool_members')
      .select('id, user_id, display_name, joined_at')
      .eq('pool_id', poolData.id)
      .order('joined_at', { ascending: true })

    if (membersError) {
      console.error('Failed to load members:', membersError.message)
    }

    const members = (membersData ?? []) as PoolMember[]
    const memberById = new Map(members.map((member) => [member.id, member]))

    const buildFallbackEntries = (): LeaderboardEntry[] =>
      members.map((member, index) => ({
        rank: index + 1,
        prev_rank: null,
        user_id: member.user_id,
        display_name: member.display_name,
        points: 0,
        correct_predictions: 0,
      }))

    const { data: cacheData, error: cacheError } = await supabase
      .from('leaderboard_cache')
      .select('rank, prev_rank, member_id, total_points, correct_winners')
      .eq('pool_id', poolData.id)
      .order('rank', { ascending: true })

    let entries: LeaderboardEntry[] = buildFallbackEntries()

    if (cacheError) {
      console.error('Failed to load leaderboard:', cacheError.message)
    } else if (cacheData && cacheData.length > 0) {
      entries = cacheData.map((row) => {
        const member = memberById.get(row.member_id)
        return {
          rank: row.rank,
          prev_rank: row.prev_rank > 0 ? row.prev_rank : null,
          user_id: member?.user_id ?? '',
          display_name: member?.display_name ?? 'Unknown',
          points: row.total_points ?? 0,
          correct_predictions: row.correct_winners ?? 0,
        }
      })
    }

    setPool(poolData as Pool)
    setMemberCount(members.length)
    setLeaderboard(entries)
    setPageLoading(false)
  }, [inviteCode])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.replace('/login')
      return
    }

    loadPoolData()
  }, [authLoading, user, router, loadPoolData])

  async function handleSharePool() {
    const joinUrl = `${window.location.origin}/join/${inviteCode}`
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
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
        <p className="text-[#5a7080]">Loading pool…</p>
      </main>
    )
  }

  if (notFound || !pool) {
    return (
      <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-8 text-center">
          <p className="text-lg font-semibold text-[#f0f4f8]">Pool not found</p>
          <p className="mt-2 text-sm text-[#5a7080]">
            This invite link may be invalid.
          </p>
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

  return (
    <main className="min-h-screen bg-[#080b0f] pb-10 pt-8">
      <div className="mx-auto w-full max-w-lg px-4">
        <header className="mb-6">
          <h1 className="font-display text-4xl tracking-wide text-[#f0f4f8]">
            {pool.name}
          </h1>
          <p className="mt-1 font-mono text-xs text-[#5a7080]">
            Invite: {pool.invite_code}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#1e2d3d] bg-[#111a27] px-3 py-1.5 text-xs text-[#5a7080]">
              {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
            </span>
            <span className="rounded-full border border-[#1e2d3d] bg-[#111a27] px-3 py-1.5 text-xs text-[#5a7080]">
              0 Matches played
            </span>
            <span className="rounded-full border border-[#1e2d3d] bg-[#111a27] px-3 py-1.5 text-xs text-[#5a7080]">
              Group Stage
            </span>
          </div>
        </header>

        <section className="mb-6 overflow-hidden rounded-2xl border border-[#1e2d3d] bg-[#111a27]">
          <div className="border-b border-[#1e2d3d] px-4 py-3">
            <h2 className="font-display text-xl tracking-wide text-[#f0f4f8]">
              Leaderboard
            </h2>
          </div>

          {leaderboard.length === 0 ? (
            <p className="p-6 text-center text-sm text-[#5a7080]">
              No members in this pool yet.
            </p>
          ) : (
            <ul>
              {leaderboard.map((entry) => {
                const isYou = user?.id === entry.user_id
                const movement = getRankMovement(entry.rank, entry.prev_rank)

                return (
                  <li
                    key={`${entry.user_id}-${entry.rank}`}
                    className={`flex items-center justify-between border-b border-[#1e2d3d] p-4 last:border-b-0 ${
                      isYou
                        ? 'border-l-2 border-l-[#00e676] bg-[#00e676]/5'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono text-sm text-[#5a7080]">
                        {entry.rank}
                      </span>
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                          isYou
                            ? 'bg-[#00e676]/20 text-[#00e676]'
                            : 'bg-[#1a2535] text-[#f0f4f8]'
                        }`}
                      >
                        {entry.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              isYou ? 'text-[#00e676]' : 'text-[#f0f4f8]'
                            }`}
                          >
                            {entry.display_name}
                          </span>
                          {isYou && (
                            <span className="text-xs text-[#00e676]">
                              (you)
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#5a7080]">
                          {entry.correct_predictions} correct
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-xs ${movement.className}`}
                      >
                        {movement.label}
                      </span>
                      <div className="font-display text-xl text-[#f0f4f8]">
                        {entry.points}
                        <span className="ml-0.5 font-sans text-xs text-[#5a7080]">
                          pts
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/pool/${inviteCode}/predict`}
            className="flex-1 rounded-lg bg-[#00e676] px-4 py-3 text-center text-sm font-semibold text-[#080b0f] hover:bg-[#00e676]/90 transition-colors"
          >
            Make Predictions
          </Link>
          <button
            type="button"
            onClick={handleSharePool}
            className="flex-1 rounded-lg border border-[#1e2d3d] bg-[#111a27] px-4 py-3 text-sm font-semibold text-[#f0f4f8] hover:border-[#00e676]/50 transition-colors"
          >
            {copied ? 'Link copied!' : 'Share Pool'}
          </button>
        </div>
      </div>
    </main>
  )
}
