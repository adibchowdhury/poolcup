import type { UpcomingMatch } from './fetch-upcoming-matches'
import {
  getAllMockFixtures,
  type MockFixtureWithSport,
} from './mock-sports-fixtures'

export const SCOREBOARD_TOTAL_CARD_TARGET = 5

export type ScoreboardUpcomingItem =
  | { kind: 'real'; key: string; kickoff_at: string; match: UpcomingMatch }
  | {
      kind: 'mock'
      key: string
      kickoff_at: string
      fixture: MockFixtureWithSport
    }

/** Shift stale mock kickoffs forward so they sort after the featured card. */
export function normalizeMockFixturesForScoreboard(
  fixtures: MockFixtureWithSport[],
  nowMs: number,
): MockFixtureWithSport[] {
  let pastIndex = 0

  return fixtures.map((fixture) => {
    if (fixture.status === 'live') {
      return fixture
    }

    const kickoffMs = new Date(fixture.kickoff_at).getTime()
    if (kickoffMs > nowMs) {
      return fixture
    }

    pastIndex += 1
    const offsetHours = pastIndex * 3 + 2

    return {
      ...fixture,
      kickoff_at: new Date(
        nowMs + offsetHours * 60 * 60 * 1000,
      ).toISOString(),
      status: 'upcoming',
    }
  })
}

function sortKickoffMs(item: ScoreboardUpcomingItem, nowMs: number): number {
  if (item.kind === 'mock' && item.fixture.status === 'live') {
    return nowMs - 60_000
  }

  return new Date(item.kickoff_at).getTime()
}

export function buildScoreboardUpcomingItems(
  upcomingMatches: UpcomingMatch[],
  mockFixtures: MockFixtureWithSport[],
  featuredMatchId: string | null,
  maxAdditional: number,
  nowMs: number,
): ScoreboardUpcomingItem[] {
  const normalizedMocks = normalizeMockFixturesForScoreboard(
    mockFixtures,
    nowMs,
  )

  const realItems: ScoreboardUpcomingItem[] = upcomingMatches
    .filter((match) => match.id !== featuredMatchId)
    .map((match) => ({
      kind: 'real',
      key: match.id,
      kickoff_at: match.kickoff_at,
      match,
    }))

  const mockItems: ScoreboardUpcomingItem[] = normalizedMocks.map((fixture) => ({
    kind: 'mock',
    key: fixture.id,
    kickoff_at: fixture.kickoff_at,
    fixture,
  }))

  return [...realItems, ...mockItems]
    .sort(
      (a, b) => sortKickoffMs(a, nowMs) - sortKickoffMs(b, nowMs),
    )
    .slice(0, maxAdditional)
}

export function getScoreboardMockFixtures(): MockFixtureWithSport[] {
  return getAllMockFixtures()
}
