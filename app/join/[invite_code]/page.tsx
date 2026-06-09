'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { useAuth } from '@/src/lib/auth-context'
import { setPendingJoinInvite } from '@/src/lib/join-storage'
import { supabase } from '@/src/lib/supabase'
import { trackEvent } from '@/src/lib/track'

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

function splitDisplayName(displayName: string): {
  firstName: string
  lastName: string
} {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const joinPageViewedRef = useRef(false)

  const loadPoolData = useCallback(async () => {
    setPageLoading(true)
    setUnavailable(false)
    setError(null)

    const { data: poolData, error: poolError } = await supabase
      .from('pools')
      .select('id, name, invite_code, creator_id, created_at')
      .eq('invite_code', inviteCode)
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
    }

    loadPoolData()
  }, [authLoading, user, inviteCode, loadPoolData])

  useEffect(() => {
    if (pageLoading || unavailable || !pool || joinPageViewedRef.current) return

    joinPageViewedRef.current = true
    trackEvent('join_page_viewed', {
      poolId: pool.id,
      userId: user?.id ?? null,
      metadata: { logged_in: Boolean(user) },
    })
  }, [pageLoading, unavailable, pool, user])

  useEffect(() => {
    if (!user) return

    const userId = user.id
    const metadata = user.user_metadata as {
      first_name?: string
      last_name?: string
      display_name?: string
    }

    async function prefillName() {
      const { data: profile } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle()

      if (profile?.display_name) {
        const { firstName: first, lastName: last } = splitDisplayName(
          profile.display_name,
        )
        setFirstName(first)
        setLastName(last)
        return
      }

      if (metadata.first_name || metadata.last_name) {
        setFirstName(metadata.first_name ?? '')
        setLastName(metadata.last_name ?? '')
        return
      }

      if (metadata.display_name) {
        const { firstName: first, lastName: last } = splitDisplayName(
          metadata.display_name,
        )
        setFirstName(first)
        setLastName(last)
      }
    }

    prefillName()
  }, [user])

  async function handleJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || !pool) return

    trackEvent('join_started', {
      poolId: pool.id,
      userId: user.id,
    })

    setError(null)
    setJoining(true)

    const alreadyMember = members.some((m) => m.user_id === user.id)
    if (alreadyMember) {
      router.push(`/pool/${inviteCode}`)
      return
    }

    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim()

    if (!displayName) {
      setError('First name and last name are required')
      setJoining(false)
      return
    }

    const { error: joinError } = await supabase.from('pool_members').insert({
      pool_id: pool.id,
      user_id: user.id,
      display_name: displayName,
    })

    setJoining(false)

    if (joinError) {
      setError(joinError.message)
      return
    }

    trackEvent('join_completed', {
      poolId: pool.id,
      userId: user.id,
    })

    const { error: referralError } = await supabase.rpc('award_referral_points', {
      p_pool_id: pool.id,
    })

    if (referralError) {
      console.error('Referral points award failed:', referralError.message)
    }

    router.push(`/pool/${inviteCode}`)
  }

  const joinNext = `/join/${inviteCode}`

  if (authLoading || pageLoading) {
    return (
      <main className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <p className="text-[#5a7080]">Loading…</p>
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
            The invite link may be invalid.
          </p>
        </div>
      </main>
    )
  }

  if (!user) {
    const memberLabel =
      members.length === 1 ? '1 member' : `${members.length} members`

    return (
      <main className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex justify-center">
              <PoolCupLogo />
            </div>
            <p className="mt-1 text-sm text-[#5a7080]">
              World Cup 2026 Prediction Pools
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#1e2d3d] bg-[#111a27] shadow-xl">
            <div className="bg-gradient-to-br from-[#00e676]/20 to-[#111a27] p-6">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#080b0f]/50 px-2.5 py-1">
                <span className="text-sm">⚽</span>
                <span className="text-xs text-[#5a7080]">World Cup Pool</span>
              </div>
              <h1 className="font-display text-3xl tracking-wide text-[#f0f4f8]">
                {pool.name}
              </h1>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#00e676]/10 px-3 py-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#00e676]" />
                <span className="text-sm font-medium text-[#00e676]">
                  {memberLabel} already in this pool
                </span>
              </div>
            </div>

            <div className="p-6">
              <p className="text-center text-sm leading-relaxed text-[#5a7080]">
                You&apos;ve been invited to join{' '}
                <span className="font-medium text-[#f0f4f8]">{pool.name}</span>
                ! Create a free account to make your World Cup predictions.
              </p>

              <div className="mt-6">
                <GoogleSignInButton next={joinNext} variant="primary" />
              </div>

              <p className="mt-4 text-center text-sm text-[#5a7080]">
                <Link
                  href={`/create-account?next=${encodeURIComponent(joinNext)}`}
                  className="font-medium text-[#00e676] hover:underline"
                >
                  Sign up with email
                </Link>
              </p>

              <p className="mt-6 text-center text-sm text-[#5a7080]">
                Already have an account?{' '}
                <Link
                  href={`/login?next=${encodeURIComponent(joinNext)}`}
                  className="font-medium text-[#00e676] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
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
            <form onSubmit={handleJoin} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="join-first-name"
                    className="mb-1.5 block text-xs font-medium text-[#5a7080]"
                  >
                    First name
                  </label>
                  <input
                    id="join-first-name"
                    type="text"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    className="w-full rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:border-[#00e676] focus:outline-none focus:ring-1 focus:ring-[#00e676]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="join-last-name"
                    className="mb-1.5 block text-xs font-medium text-[#5a7080]"
                  >
                    Last name
                  </label>
                  <input
                    id="join-last-name"
                    type="text"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Jordan"
                    className="w-full rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:border-[#00e676] focus:outline-none focus:ring-1 focus:ring-[#00e676]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={joining}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#00e676] px-5 py-3 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-50"
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
