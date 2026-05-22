'use client'

import type { User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getCurrentUser } from './auth'
import { getPendingJoinInvite } from './join-storage'
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

  const refreshUser = useCallback(async () => {
    const { user: currentUser } = await getCurrentUser()
    setUser(currentUser)
  }, [])

  useEffect(() => {
    let mounted = true

    async function init() {
      const { user: currentUser } = await getCurrentUser()
      if (mounted) {
        setUser(currentUser)
        setLoading(false)
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (loading || !user) return

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
