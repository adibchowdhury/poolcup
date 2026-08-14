'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/src/lib/auth-context'
import {
  applyAccentThemeToDocument,
  type AccentThemeKey,
} from '@/src/lib/accent-theme'

type UserAccentContextValue = {
  loading: boolean
  isPro: boolean
  accentTheme: AccentThemeKey | null
  error: string | null
  saving: boolean
  refresh: () => Promise<void>
  setAccentTheme: (
    next: AccentThemeKey | null,
  ) => Promise<{ ok: boolean; error?: string }>
}

const UserAccentContext = createContext<UserAccentContextValue | null>(null)

/**
 * Applies Pro accent CSS vars on <html> when entitled.
 * Free / downgraded users keep stored accent_theme in DB but do not apply it
 * (default green). PoolThemeScope still wins inside pool subtrees.
 */
export function UserAccentProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [accentTheme, setAccentThemeState] = useState<AccentThemeKey | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setIsPro(false)
      setAccentThemeState(null)
      applyAccentThemeToDocument(null, false)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/me/accent-theme', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (res.status === 401) {
        setIsPro(false)
        setAccentThemeState(null)
        applyAccentThemeToDocument(null, false)
        return
      }
      const json = (await res.json()) as {
        isPro?: boolean
        accentTheme?: AccentThemeKey | null
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load accent theme')
      }
      const nextPro = json.isPro === true
      const nextAccent = json.accentTheme ?? null
      setIsPro(nextPro)
      setAccentThemeState(nextAccent)
      applyAccentThemeToDocument(nextAccent, nextPro)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      // Fail closed: no custom accent if we can't confirm Pro.
      applyAccentThemeToDocument(null, false)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  useEffect(() => {
    return () => {
      applyAccentThemeToDocument(null, false)
    }
  }, [])

  const setAccentTheme = useCallback(
    async (next: AccentThemeKey | null) => {
      if (!isPro) {
        return { ok: false, error: 'pro_required' }
      }
      setSaving(true)
      setError(null)
      try {
        const res = await fetch('/api/me/accent-theme', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accentTheme: next }),
        })
        const json = (await res.json()) as {
          accentTheme?: AccentThemeKey | null
          error?: string
        }
        if (res.status === 403) {
          setIsPro(false)
          applyAccentThemeToDocument(null, false)
          return { ok: false, error: 'pro_required' }
        }
        if (!res.ok) {
          throw new Error(json.error || 'Failed to save accent theme')
        }
        const saved = json.accentTheme ?? null
        setAccentThemeState(saved)
        applyAccentThemeToDocument(saved, true)
        return { ok: true }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save accent theme'
        setError(message)
        return { ok: false, error: message }
      } finally {
        setSaving(false)
      }
    },
    [isPro],
  )

  const value = useMemo(
    () => ({
      loading,
      isPro,
      accentTheme,
      error,
      saving,
      refresh,
      setAccentTheme,
    }),
    [loading, isPro, accentTheme, error, saving, refresh, setAccentTheme],
  )

  return (
    <UserAccentContext.Provider value={value}>
      {children}
    </UserAccentContext.Provider>
  )
}

export function useUserAccent(): UserAccentContextValue {
  const ctx = useContext(UserAccentContext)
  if (!ctx) {
    throw new Error('useUserAccent must be used within UserAccentProvider')
  }
  return ctx
}
