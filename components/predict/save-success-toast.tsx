'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const AUTO_DISMISS_MS = 3000
const FADE_OUT_MS = 300

interface SaveSuccessToastProps {
  message: string | null
  onDismiss: () => void
}

export function SaveSuccessToast({ message, onDismiss }: SaveSuccessToastProps) {
  const [phase, setPhase] = useState<'hidden' | 'visible' | 'exiting'>('hidden')

  const startExit = useCallback(() => {
    setPhase('exiting')
  }, [])

  useEffect(() => {
    if (!message) {
      setPhase('hidden')
      return
    }

    setPhase('visible')
    const dismissTimer = window.setTimeout(startExit, AUTO_DISMISS_MS)
    return () => window.clearTimeout(dismissTimer)
  }, [message, startExit])

  useEffect(() => {
    if (phase !== 'exiting') return

    const removeTimer = window.setTimeout(() => {
      setPhase('hidden')
      onDismiss()
    }, FADE_OUT_MS)

    return () => window.clearTimeout(removeTimer)
  }, [phase, onDismiss])

  if (phase === 'hidden' || !message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto fixed bottom-20 right-4 z-50 flex max-w-sm items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-opacity duration-300 sm:bottom-6 sm:right-6',
        'bg-[#22c55e] text-[#0a1018]',
        phase === 'visible' ? 'opacity-100' : 'opacity-0',
      )}
    >
      <Check className="h-5 w-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-sm font-semibold">{message}</span>
      <button
        type="button"
        onClick={startExit}
        className="shrink-0 rounded-md p-1 text-[#0a1018]/70 transition-colors hover:bg-[#0a1018]/10 hover:text-[#0a1018]"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
