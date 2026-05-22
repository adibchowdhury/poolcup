'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/lib/auth-context'
import { setPendingJoinInvite } from '@/src/lib/join-storage'
import { supabase } from '@/src/lib/supabase'

type Pool = {
  id: string
  name: string
  invite_code: string
  creator_id: string
  created_at: string | null
}

type PoolMember = {
  id: string
  user_id: string
  display_name: string
}

export default function JoinPoolPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.invite_code as string
  const { user, loading: authLoading } = useAuth()

  const [pool, setPool] = useState<Pool | null>(null)
  const [members, setMembers] = useState<PoolMember[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPoolData = useCallback(async () => {
    setPageLoading(true)
    setUnavailable(false)
    setError(null)

    const { data: poolData, error: poolError } = await supabase
      .from('pools')
      .select('id, name, invite_code, creator_id, created_at')
      .eq('invite_code', inviteCode)
      .eq('payment_status', 'active')
      .maybeSingle()

    if (poolError || !poolData) {
      setPool(null)
      setMembers([])
      setUnavailable(true)
      setPageLoading(false)
      return
    }

    const { data: membersData, error: membersError } = await supabase
      .from('pool_members')
      .select('id, user_id, display_name')
      .eq('pool_id', poolData.id)
      .order('display_name')

    if (membersError) {
      console.error('Failed to load members:', membersError.message)
    }

    setPool(poolData as Pool)
    setMembers((membersData ?? []) as PoolMember[])
    setPageLoading(false)
  }, [inviteCode])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setPendingJoinInvite(inviteCode)
      router.replace('/login')
      return
    }

    loadPoolData()
  }, [authLoading, user, inviteCode, router, loadPoolData])

  async function handleJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || !pool) return

    setError(null)
    setJoining(true)

    const alreadyMember = members.some((m) => m.user_id === user.id)
    if (alreadyMember) {
      router.push(`/pool/${inviteCode}`)
      return
    }

    const { error: joinError } = await supabase.from('pool_members').insert({
      pool_id: pool.id,
      user_id: user.id,
      display_name: displayName.trim(),
    })

    setJoining(false)

    if (joinError) {
      setError(joinError.message)
      return
    }

    router.push(`/pool/${inviteCode}`)
  }

  if (authLoading || (!user && !unavailable)) {
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

  if (unavailable || !pool) {
    return (
      <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-8 text-center">
          <p className="text-lg font-semibold text-[#f0f4f8]">
            This pool is not available
          </p>
          <p className="mt-2 text-sm text-[#5a7080]">
            The invite link may be invalid or the pool has not been activated yet.
          </p>
        </div>
      </main>
    )
  }

  const creatorMember = members.find((m) => m.user_id === pool.creator_id)
  const creatorName = creatorMember?.display_name ?? 'Pool creator'
  const createdDate = pool.created_at
    ? new Date(pool.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-[#1e2d3d] bg-[#111a27] shadow-xl">
          <div className="bg-gradient-to-br from-[#00e676]/20 to-[#111a27] p-6">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#080b0f]/50 px-2.5 py-1">
              <span className="text-sm">⚽</span>
              <span className="text-xs text-[#5a7080]">World Cup Pool</span>
            </div>
            <h1 className="font-display text-3xl tracking-wide text-[#f0f4f8]">
              {pool.name}
            </h1>
            <p className="mt-2 text-sm text-[#5a7080]">
              Created by {creatorName}
              {createdDate ? ` · Started ${createdDate}` : ''}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#00e676]/10 px-3 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#00e676]" />
              <span className="text-sm font-medium text-[#00e676]">
                {members.length} {members.length === 1 ? 'member' : 'members'}{' '}
                joined
              </span>
            </div>
          </div>

          <div className="p-6">
            <form onSubmit={handleJoin} className="flex gap-3">
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="flex-1 rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:border-[#00e676] focus:outline-none focus:ring-1 focus:ring-[#00e676]"
              />
              <button
                type="submit"
                disabled={joining}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#00e676] px-5 py-3 text-sm font-semibold text-[#080b0f] hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {joining ? 'Joining…' : 'Join →'}
              </button>
            </form>

            {error && (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="mt-6 border-t border-[#1e2d3d] pt-6">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#5a7080]">
                Members
              </h2>
              {members.length === 0 ? (
                <p className="text-sm text-[#5a7080]">No members yet. Be the first!</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((member) => {
                    const isCreator = member.user_id === pool.creator_id
                    const isYou = user?.id === member.user_id

                    return (
                      <li
                        key={member.id}
                        className="flex items-center justify-between rounded-lg p-3 hover:bg-[#1a2535]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a2535] text-sm font-semibold text-[#f0f4f8]">
                            {member.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[#f0f4f8]">
                                {member.display_name}
                              </span>
                              {isCreator && <span className="text-sm">👑</span>}
                              {isYou && (
                                <span className="text-xs text-[#00e676]">
                                  (you)
                                </span>
                              )}
                            </div>
                            {isCreator && (
                              <span className="text-xs text-[#5a7080]">
                                Creator
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
