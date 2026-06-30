'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase-mobile'

/**
 * Mirrors the website dashboard total-points source: public.users.points
 * with the same realtime subscription as components/dashboard/dashboard-view.tsx.
 */
export function useLiveTotalPoints(userId: string | null, enabled: boolean) {
  const [totalPoints, setTotalPoints] = useState<number | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const refreshUserPoints = useCallback(async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Failed to refresh user points:', error.message)
      return
    }

    if (typeof data?.points === 'number') {
      setTotalPoints(data.points)
      setHasLoaded(true)
    }
  }, [userId])

  useEffect(() => {
    if (!enabled || !userId || typeof window === 'undefined') {
      return
    }

    setTotalPoints(null)
    setHasLoaded(false)

    void refreshUserPoints()

    const channel = supabase
      .channel(`user-points-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { points?: number }
          if (typeof row.points === 'number') {
            setTotalPoints(row.points)
            setHasLoaded(true)
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void refreshUserPoints()
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, userId, refreshUserPoints])

  const formattedPoints =
    hasLoaded && totalPoints !== null
      ? totalPoints.toLocaleString()
      : '—'

  return {
    totalPoints,
    formattedPoints,
    loading: !hasLoaded,
  }
}
