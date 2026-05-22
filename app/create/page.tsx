'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/lib/auth-context'
import { supabase } from '@/src/lib/supabase'

const scoringStyles = [
  { id: 'classic', label: 'Classic' },
  { id: 'winner', label: 'Winner Only' },
  { id: 'exact', label: 'Exact Score' },
] as const

type ScoringStyleId = (typeof scoringStyles)[number]['id']

export default function CreatePoolPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [poolName, setPoolName] = useState('')
  const [scoringStyle, setScoringStyle] = useState<ScoringStyleId>('classic')
  const [submitting, setSubmitting] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return

    setError(null)
    setSubmitting(true)
    setLoadingMessage('Creating pool…')

    const { data: pool, error: insertError } = await supabase
      .from('pools')
      .insert({
        name: poolName.trim(),
        scoring_style: scoringStyle,
        creator_id: user.id,
        payment_status: 'pending',
      })
      .select('id')
      .single()

    if (insertError || !pool) {
      setSubmitting(false)
      setLoadingMessage(null)
      setError(insertError?.message ?? 'Failed to create pool')
      return
    }

    setLoadingMessage('Redirecting to checkout…')

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: pool.id, userId: user.id }),
      })

      const data = (await res.json()) as { url?: string; error?: string }

      if (!res.ok || !data.url) {
        setSubmitting(false)
        setLoadingMessage(null)
        setError(data.error ?? 'Failed to create checkout session')
        return
      }

      window.location.href = data.url
    } catch {
      setSubmitting(false)
      setLoadingMessage(null)
      setError('Failed to create checkout session')
    }
  }

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <p className="text-[#5a7080]">Loading…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[#1e2d3d] bg-[#111a27] p-8 shadow-xl">
          <Link
            href="/dashboard"
            className="text-sm text-[#5a7080] hover:text-[#00e676] transition-colors"
          >
            ← Back to dashboard
          </Link>

          <h1 className="mt-4 font-display text-3xl tracking-wide text-[#f0f4f8]">
            Create a Pool
          </h1>
          <p className="mt-2 text-sm text-[#5a7080]">
            Set up your pool, then complete a one-time $15 payment.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label
                htmlFor="pool-name"
                className="block text-xs font-medium uppercase tracking-wider text-[#5a7080] mb-2"
              >
                Pool name
              </label>
              <input
                id="pool-name"
                type="text"
                required
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder="Marketing Team WC 2026"
                className="w-full rounded-lg border border-[#1e2d3d] bg-[#080b0f] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:outline-none focus:ring-2 focus:ring-[#00e676]/50 focus:border-[#00e676]"
              />
            </div>

            <div>
              <span className="block text-xs font-medium uppercase tracking-wider text-[#5a7080] mb-2">
                Scoring style
              </span>
              <div className="flex flex-col gap-2 sm:flex-row">
                {scoringStyles.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setScoringStyle(style.id)}
                    className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      scoringStyle === style.id
                        ? 'border-2 border-[#00e676] bg-[#00e676]/5 text-[#00e676]'
                        : 'border border-[#1e2d3d] text-[#5a7080] hover:text-[#f0f4f8]'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {submitting
                ? (loadingMessage ?? 'Processing…')
                : 'Create pool'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
