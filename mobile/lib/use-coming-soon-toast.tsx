'use client'

import { useCallback, useState } from 'react'

export function useComingSoonToast() {
  const [message, setMessage] = useState<string | null>(null)

  const showComingSoon = useCallback((text = 'Coming soon') => {
    setMessage(text)
    window.setTimeout(() => setMessage(null), 2500)
  }, [])

  return { comingSoonMessage: message, showComingSoon }
}

export function ComingSoonToast({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(1rem+var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] z-[70] flex justify-center px-4"
      role="status"
    >
      <p className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg">
        {message}
      </p>
    </div>
  )
}
