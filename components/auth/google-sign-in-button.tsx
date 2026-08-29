'use client'

import { useState, type CSSProperties } from 'react'
import { Loader2 } from 'lucide-react'
import { GoogleIcon } from '@/components/auth/google-icon'
import { signInWithGoogle } from '@/src/lib/auth'
import { AUTH_FOCUS_VISIBLE_CLASS } from '@/src/lib/auth-form'
import { bindTactilePress } from '@/src/lib/tactile-press'
import { cn } from '@/lib/utils'

type GoogleSignInButtonProps = {
  next?: string
  variant?: 'default' | 'primary' | 'branded'
  /** Button label when idle (default: Continue with Google). */
  label?: string
}

/** White Google surface — edge derives from shared --tactile-btn-surface mix. */
const GOOGLE_BRANDED_SURFACE = '#ffffff'

export function GoogleSignInButton({
  next,
  variant = 'default',
  label = 'Continue with Google',
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogleSignIn() {
    setError(null)
    setLoading(true)

    const { error: authError } = await signInWithGoogle(next)

    if (authError) {
      setLoading(false)
      setError(authError.message)
    }
  }

  const isTactile = variant === 'branded'

  const buttonClassName =
    variant === 'primary'
      ? cn(
          'flex w-full items-center justify-center gap-3 rounded-lg bg-[#00e676] px-4 py-3 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90 disabled:cursor-not-allowed disabled:opacity-60',
          AUTH_FOCUS_VISIBLE_CLASS,
        )
      : variant === 'branded'
        ? cn(
            // Google Identity light theme + shared straight-down tactile (`.ui-tactile-btn`).
            // Fill #FFF, stroke #747775; multicolor G via GoogleIcon SVG.
            // Surface via inline style → edge = color-mix(surface 70%, black).
            'ui-tactile-btn flex w-full items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-4 py-3 text-sm font-medium text-[#3c4043] hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-60',
            AUTH_FOCUS_VISIBLE_CLASS,
          )
        : cn(
            'flex w-full items-center justify-center gap-3 rounded-lg border border-[#1e2d3d] bg-white px-4 py-3 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-60',
            AUTH_FOCUS_VISIBLE_CLASS,
          )

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={loading}
        className={buttonClassName}
        style={
          isTactile
            ? ({ '--tactile-btn-surface': GOOGLE_BRANDED_SURFACE } as CSSProperties)
            : undefined
        }
        onPointerDown={(event) => {
          if (isTactile) bindTactilePress(event.currentTarget)
        }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#5a7080]" aria-hidden />
        ) : (
          <GoogleIcon className="h-5 w-5 shrink-0" />
        )}
        {loading ? 'Redirecting…' : label}
      </button>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
