'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/src/lib/auth-context'
import {
  DM_MARKED_READ_EVENT,
  emitDmMarkedRead,
  markDmRead,
  type DmMessageRow,
} from '@/src/lib/dm-chats'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'
import type { PoolChatMessage } from '@/src/lib/pool-chat-helpers'
import {
  emitPoolMarkedRead,
  fetchUnreadChatCount,
  markPoolRead,
  POOL_MARKED_READ_EVENT,
} from '@/src/lib/pool-unread-counts'
import { supabase } from '@/src/lib/supabase'

const UnreadChatCountContext = createContext(0)

type DmRealtimePayload = DmMessageRow & {
  conversation_id?: string
}

function UnreadChatCountProviderContent({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { openChatPoolId, openDmConversationId } = useMobileChatChrome()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`
  const [count, setCount] = useState(0)
  const openChatPoolIdRef = useRef(openChatPoolId)
  const openDmConversationIdRef = useRef(openDmConversationId)
  const userIdRef = useRef(user?.id ?? null)

  useEffect(() => {
    openChatPoolIdRef.current = openChatPoolId
  }, [openChatPoolId])

  useEffect(() => {
    openDmConversationIdRef.current = openDmConversationId
  }, [openDmConversationId])

  useEffect(() => {
    userIdRef.current = user?.id ?? null
  }, [user?.id])

  const refreshUnreadChatCount = useCallback(async () => {
    const total = await fetchUnreadChatCount(supabase)
    setCount(total)
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setCount(0)
      return
    }

    void refreshUnreadChatCount()
  }, [refreshUnreadChatCount, routeKey, user?.id])

  useEffect(() => {
    function handleMarkedRead() {
      void refreshUnreadChatCount()
    }

    window.addEventListener(POOL_MARKED_READ_EVENT, handleMarkedRead)
    window.addEventListener(DM_MARKED_READ_EVENT, handleMarkedRead)
    return () => {
      window.removeEventListener(POOL_MARKED_READ_EVENT, handleMarkedRead)
      window.removeEventListener(DM_MARKED_READ_EVENT, handleMarkedRead)
    }
  }, [refreshUnreadChatCount])

  useEffect(() => {
    if (!user?.id) {
      return
    }

    const channel = supabase
      .channel(`nav-unread-messages-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pool_messages',
        },
        (payload) => {
          const row = payload.new as PoolChatMessage
          const currentUserId = userIdRef.current
          if (!currentUserId || row.user_id === currentUserId) {
            return
          }

          const activePoolId = openChatPoolIdRef.current
          if (activePoolId && row.pool_id === activePoolId) {
            void (async () => {
              const marked = await markPoolRead(supabase, row.pool_id, currentUserId)
              if (marked) {
                emitPoolMarkedRead(row.pool_id)
              }
            })()
            return
          }

          setCount((previous) => previous + 1)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
        },
        (payload) => {
          const row = payload.new as DmRealtimePayload
          const currentUserId = userIdRef.current
          if (!currentUserId || row.sender_id === currentUserId) {
            return
          }

          const conversationId = row.conversation_id
          const activeDmId = openDmConversationIdRef.current
          if (conversationId && activeDmId && conversationId === activeDmId) {
            void (async () => {
              const marked = await markDmRead(supabase, conversationId)
              if (marked) {
                emitDmMarkedRead(conversationId)
              }
            })()
            return
          }

          setCount((previous) => previous + 1)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id])

  return (
    <UnreadChatCountContext.Provider value={count}>
      {children}
    </UnreadChatCountContext.Provider>
  )
}

export function UnreadChatCountProvider({ children }: { children: ReactNode }) {
  return <UnreadChatCountProviderContent>{children}</UnreadChatCountProviderContent>
}

export function useUnreadChatCount(): number {
  return useContext(UnreadChatCountContext)
}
