'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildScoreboardUpcomingItems,
  getScoreboardMockFixtures,
  SCOREBOARD_TOTAL_CARD_TARGET,
  type ScoreboardUpcomingItem,
} from '../lib/scoreboard-upcoming-items'
import { fetchUpcomingMatches } from '../lib/fetch-upcoming-matches'
import { supabase } from '../lib/supabase-mobile'
import { MobileLiveScoreboard } from './mobile-live-scoreboard'
import { SCOREBOARD_CARD_SLOT_CLASS } from './mobile-scoreboard-card-shared'
import {
  MockUpcomingScoreboardCard,
  RealUpcomingScoreboardCard,
} from './mobile-scoreboard-upcoming-card'

const REFETCH_INTERVAL_MS = 30_000

export function MobilePoolsScoreboardRow({
  onOpenMatch,
}: {
  onOpenMatch: (matchId: string) => void
}) {
  const [featuredMatchId, setFeaturedMatchId] = useState<string | null>(null)
  const [upcomingItems, setUpcomingItems] = useState<ScoreboardUpcomingItem[]>(
    [],
  )

  const mockFixtures = useMemo(() => getScoreboardMockFixtures(), [])

  const loadUpcomingItems = useCallback(async () => {
    const nowMs = Date.now()
    const { matches, error } = await fetchUpcomingMatches(supabase)

    if (error) {
      setUpcomingItems(
        buildScoreboardUpcomingItems(
          [],
          mockFixtures,
          featuredMatchId,
          SCOREBOARD_TOTAL_CARD_TARGET - 1,
          nowMs,
        ),
      )
      return
    }

    setUpcomingItems(
      buildScoreboardUpcomingItems(
        matches,
        mockFixtures,
        featuredMatchId,
        SCOREBOARD_TOTAL_CARD_TARGET - 1,
        nowMs,
      ),
    )
  }, [featuredMatchId, mockFixtures])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void loadUpcomingItems()
  }, [loadUpcomingItems])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadUpcomingItems()
    }, REFETCH_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [loadUpcomingItems])

  return (
    <div
      className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-max flex-nowrap gap-3">
        <div className={SCOREBOARD_CARD_SLOT_CLASS}>
          <MobileLiveScoreboard
            onOpenMatch={onOpenMatch}
            onFeaturedMatchLoaded={setFeaturedMatchId}
          />
        </div>

        {upcomingItems.map((item) => (
          <div key={item.key} className={SCOREBOARD_CARD_SLOT_CLASS}>
            {item.kind === 'real' ? (
              <RealUpcomingScoreboardCard
                match={item.match}
                onOpenMatch={onOpenMatch}
              />
            ) : (
              <MockUpcomingScoreboardCard fixture={item.fixture} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
