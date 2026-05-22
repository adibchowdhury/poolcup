'use client'

import { FormEvent, useState } from 'react'
import { sendMagicLink } from '@/src/lib/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await sendMagicLink(email)

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    setSent(true)
  }

  return (
    <main className="min-h-screen bg-[#080b0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-[#111a27] border border-[#1e2d3d] p-8 shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight text-[#f0f4f8]">
          PoolCup
        </h1>
        <p className="mt-2 text-sm text-[#5a7080]">
          Sign in with a magic link — no password needed.
        </p>

        {sent ? (
          <div className="mt-8 rounded-lg border border-[#00e676]/30 bg-[#00e676]/10 p-4">
            <p className="text-sm font-medium text-[#00e676]">Check your email</p>
            <p className="mt-2 text-sm text-[#5a7080]">
              We sent a sign-in link to{' '}
              <span className="text-[#f0f4f8]">{email}</span>. Click the link to
              continue to your dashboard.
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false)
                setEmail('')
              }}
              className="mt-4 text-sm text-[#5a7080] hover:text-[#00e676] transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#5a7080] mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg bg-[#080b0f] border border-[#1e2d3d] px-4 py-3 text-[#f0f4f8] placeholder:text-[#5a7080]/60 focus:outline-none focus:ring-2 focus:ring-[#00e676]/50 focus:border-[#00e676]"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] hover:bg-[#00e676]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
