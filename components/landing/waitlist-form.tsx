'use client'

import { FormEvent, useState } from 'react'
import { isReferralUuid, readPoolcupRefCookieClient } from '@/src/lib/referral'
import { cn } from '@/lib/utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

type WaitlistFormProps = {
  /** Visual variant: hero (dark overlay) vs coming-soon page. */
  variant?: 'hero' | 'coming-soon'
  className?: string
  id?: string
}

export function WaitlistForm({
  variant = 'hero',
  className,
  id,
}: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isHero = variant === 'hero'

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)

    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      setStatus('error')
      setErrorMessage('Please enter a valid email address.')
      return
    }

    setStatus('loading')

    const refRaw = readPoolcupRefCookieClient()
    const ref = isReferralUuid(refRaw) ? refRaw.trim() : null

    try {
      const response = await fetch('/api/join-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, ref }),
      })

      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        setStatus('error')
        setErrorMessage(
          payload?.error ||
            'Something went wrong. Please try again in a moment.',
        )
        return
      }

      setStatus('success')
    } catch (error) {
      console.error('join-waitlist request failed:', error)
      setStatus('error')
      setErrorMessage('Something went wrong. Please try again in a moment.')
    }
  }

  if (status === 'success') {
    return (
      <div
        id={id}
        className={cn(
          'w-full max-w-xl text-center sm:text-left',
          className,
        )}
        role="status"
      >
        <p
          className={cn(
            'rounded-lg border px-5 py-4 text-base font-semibold sm:text-lg',
            isHero
              ? 'border-[#00e676]/40 bg-[#00e676]/12 text-[#00e676]'
              : 'border-primary/40 bg-primary/10 text-primary',
          )}
        >
          You&apos;re on the list! We&apos;ll email you when PoolCup launches.
        </p>
      </div>
    )
  }

  return (
    <div id={id} className={cn('w-full max-w-xl', className)}>
      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex w-full flex-col gap-3 sm:flex-row sm:items-stretch',
        )}
        noValidate
      >
        <label className="sr-only" htmlFor={`waitlist-email-${variant}`}>
          Email address
        </label>
        <input
          id={`waitlist-email-${variant}`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') {
              setStatus('idle')
              setErrorMessage(null)
            }
          }}
          placeholder="Enter your email"
          disabled={status === 'loading'}
          className={cn(
            'min-h-12 w-full flex-1 rounded-lg border px-4 text-base outline-none transition-colors',
            'placeholder:text-white/35 focus:ring-2 focus:ring-[#00e676]/50',
            isHero
              ? 'border-white/20 bg-[#080b0f]/70 text-[#f0f4f8]'
              : 'border-border bg-background text-foreground',
            status === 'error' && 'border-red-400/70 focus:ring-red-400/40',
          )}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className={cn(
            'inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg px-6 text-base font-semibold transition-all',
            'bg-[#00e676] text-[#080b0f] hover:scale-[1.02] hover:bg-[#00e676]/90',
            'hover:shadow-[0_0_28px_rgba(0,230,118,0.35)] active:scale-95',
            'disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 disabled:hover:shadow-none',
            'sm:min-w-[11.5rem]',
          )}
        >
          {status === 'loading' ? 'Joining…' : 'Join the Waitlist'}
        </button>
      </form>

      {errorMessage ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <p
        className={cn(
          'mt-3 text-center text-sm sm:text-left',
          isHero ? 'text-[#f0f4f8]/65' : 'text-muted-foreground',
        )}
      >
        Launching Aug 24 — be the first in.
      </p>
    </div>
  )
}
