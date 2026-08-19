'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchMakeYourPicksQueue,
  type MakeYourPicksMatch,
} from '@/src/lib/fetch-make-your-picks-queue'
import {
  readMakeYourPicksPickedMatchIds,
  subscribeMakeYourPicksPicked,
} from '@/src/lib/make-your-picks-session'
import { supabase } from '@/src/lib/supabase'

export type MakeYourPicksQueueState = {
  loading: boolean
  matches: MakeYourPicksMatch[]
  hasPools: boolean
  error: string | null
  pickedMatchIds: Set<string>
  reload: () => Promise<void>
}

const MakeYourPicksQueueContext = createContext<MakeYourPicksQueueState | null>(
  null,
)

export function useMakeYourPicksQueue(userId: string): MakeYourPicksQueueState {
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<MakeYourPicksMatch[]>([])
  const [hasPools, setHasPools] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickedMatchIds, setPickedMatchIds] = useState<Set<string>>(() => new Set())

  const syncPicked = useCallback(() => {
    setPickedMatchIds(readMakeYourPicksPickedMatchIds())
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchMakeYourPicksQueue(supabase, userId)
    setMatches(result.matches)
    setHasPools(result.hasPools)
    setError(result.error)
    syncPicked()
    setLoading(false)
  }, [userId, syncPicked])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => subscribeMakeYourPicksPicked(syncPicked), [syncPicked])

  return {
    loading,
    matches,
    hasPools,
    error,
    pickedMatchIds,
    reload,
  }
}

export function MakeYourPicksQueueProvider({
  userId,
  children,
}: {
  userId: string
  children: ReactNode
}) {
  const value = useMakeYourPicksQueue(userId)
  return (
    <MakeYourPicksQueueContext.Provider value={value}>
      {children}
    </MakeYourPicksQueueContext.Provider>
  )
}

export function useMakeYourPicksQueueContext(): MakeYourPicksQueueState {
  const context = useContext(MakeYourPicksQueueContext)
  if (!context) {
    throw new Error(
      'useMakeYourPicksQueueContext must be used within MakeYourPicksQueueProvider',
    )
  }
  return context
}

export function useMakeYourPicksQueueOptional(): MakeYourPicksQueueState | null {
  return useContext(MakeYourPicksQueueContext)
}
