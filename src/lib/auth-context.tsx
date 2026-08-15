'use client'

import type { User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getCurrentUser } from './auth'
import { getPendingJoinInvite } from './join-storage'
import { identifyPostHogUser, resetPostHog } from './posthog-client'
import { supabase } from './supabase'

type AuthContextValue = {
  user: User | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)

  const refreshUser = useCallback(async () => {
    const { user: currentUser } = await getCurrentUser()
    userIdRef.current = currentUser?.id ?? null
    setUser(currentUser)
  }, [])

  useEffect(() => {
    let mounted = true

    async function init() {
      const { user: currentUser } = await getCurrentUser()
      if (mounted) {
        userIdRef.current = currentUser?.id ?? null
        setUser(currentUser)
        setLoading(false)
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      // Supabase refreshes the JWT when the tab regains focus — same user, no UI work.
      if (event === 'TOKEN_REFRESHED') {
        return
      }

      const nextUser = session?.user ?? null
      const nextId = nextUser?.id ?? null
      const prevId = userIdRef.current

      if (event === 'SIGNED_OUT') {
        if (prevId !== null) {
          userIdRef.current = null
          resetPostHog()
          setUser(null)
        }
        setLoading(false)
        return
      }

      // Duplicate SIGNED_IN / INITIAL_SESSION for the user already in context.
      if (prevId !== null && prevId === nextId) {
        setLoading(false)
        return
      }

      if (nextId !== null && nextUser) {
        userIdRef.current = nextId
        identifyPostHogUser(nextId)
        setUser(nextUser)
      } else {
        userIdRef.current = null
        setUser(null)
      }

      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (loading || !user) return
    // Don't interrupt first-session onboarding with a pending join redirect.
    if (pathname?.startsWith('/onboarding')) return

    const pendingInvite = getPendingJoinInvite()
    if (pendingInvite && !pathname?.startsWith('/join/')) {
      router.replace(`/join/${pendingInvite}`)
    }
  }, [user, loading, pathname, router])

  const value = useMemo(
    () => ({ user, loading, refreshUser }),
    [user, loading, refreshUser]
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
