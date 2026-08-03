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
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/src/lib/auth-context'
import { getIncomingFriendRequests } from '@/src/lib/friendships'
import { supabase } from '@/src/lib/supabase'

const FRIEND_REQUESTS_CHANGED_EVENT = 'poolcup:friend-requests-changed'

type FriendRequestCountContextValue = {
  count: number
  refresh: () => Promise<void>
  /** Optimistic bump after accept/decline (clamped ≥ 0). */
  adjustCount: (delta: number) => void
}

const FriendRequestCountContext =
  createContext<FriendRequestCountContextValue>({
    count: 0,
    refresh: async () => {},
    adjustCount: () => {},
  })

export function emitFriendRequestsChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(FRIEND_REQUESTS_CHANGED_EVENT))
}

function FriendRequestCountProviderContent({
  children,
}: {
  children: ReactNode
}) {
  const { user } = useAuth()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setCount(0)
      return
    }
    const incoming = await getIncomingFriendRequests(supabase)
    setCount(incoming.length)
  }, [user?.id])

  const adjustCount = useCallback((delta: number) => {
    setCount((previous) => Math.max(0, previous + delta))
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setCount(0)
      return
    }
    void refresh()
  }, [refresh, routeKey, user?.id])

  useEffect(() => {
    function handleChanged() {
      void refresh()
    }
    window.addEventListener(FRIEND_REQUESTS_CHANGED_EVENT, handleChanged)
    return () => {
      window.removeEventListener(FRIEND_REQUESTS_CHANGED_EVENT, handleChanged)
    }
  }, [refresh])

  const value = useMemo(
    () => ({ count, refresh, adjustCount }),
    [count, refresh, adjustCount],
  )

  return (
    <FriendRequestCountContext.Provider value={value}>
      {children}
    </FriendRequestCountContext.Provider>
  )
}

export function FriendRequestCountProvider({
  children,
}: {
  children: ReactNode
}) {
  return (
    <FriendRequestCountProviderContent>
      {children}
    </FriendRequestCountProviderContent>
  )
}

export function useFriendRequestCount(): FriendRequestCountContextValue {
  return useContext(FriendRequestCountContext)
}
