/**
 * DESIGN-ONLY mock fixtures for the Matches tab event selector.
 * Not backed by Supabase — do not use for predictions or navigation.
 */

export type MockSportEvent = {
  id: string
  label: string
  real: boolean
  /** Filename under /sports/ — null uses lucide fallback icon */
  iconPng: string | null
}

export const MOCK_SPORT_EVENTS: MockSportEvent[] = [
  { id: 'all', label: 'All', real: false, iconPng: null },
  { id: 'wc', label: 'FIFA World Cup', real: true, iconPng: 'soccer.png' },
  { id: 'nba', label: 'NBA', real: false, iconPng: 'basketball.png' },
  { id: 'nfl', label: 'NFL', real: false, iconPng: 'football.png' },
  { id: 'nhl', label: 'NHL', real: false, iconPng: 'hockey.png' },
  { id: 'mlb', label: 'MLB', real: false, iconPng: 'baseball.png' },
  { id: 'ufc', label: 'UFC', real: false, iconPng: null },
]

export type MockFixtureStatus = 'upcoming' | 'live'

export type MockFixture = {
  id: string
  kickoff_at: string
  team1_name: string
  team2_name: string
  team1_code: string
  team2_code: string
  round_label: string
  status: MockFixtureStatus
  score1?: number
  score2?: number
  live_label?: string
}

const NBA_FIXTURES: MockFixture[] = [
  {
    id: 'nba-1',
    kickoff_at: '2026-07-02T23:30:00.000Z',
    team1_name: 'Los Angeles Lakers',
    team2_name: 'Boston Celtics',
    team1_code: 'LAL',
    team2_code: 'BOS',
    round_label: 'Regular Season',
    status: 'live',
    score1: 98,
    score2: 102,
    live_label: 'Q4 6:12',
  },
  {
    id: 'nba-2',
    kickoff_at: '2026-07-02T01:00:00.000Z',
    team1_name: 'Golden State Warriors',
    team2_name: 'Denver Nuggets',
    team1_code: 'GSW',
    team2_code: 'DEN',
    round_label: 'Regular Season',
    status: 'upcoming',
  },
  {
    id: 'nba-3',
    kickoff_at: '2026-07-03T00:30:00.000Z',
    team1_name: 'Milwaukee Bucks',
    team2_name: 'Miami Heat',
    team1_code: 'MIL',
    team2_code: 'MIA',
    round_label: 'Regular Season',
    status: 'upcoming',
  },
  {
    id: 'nba-4',
    kickoff_at: '2026-07-04T02:00:00.000Z',
    team1_name: 'Phoenix Suns',
    team2_name: 'Dallas Mavericks',
    team1_code: 'PHX',
    team2_code: 'DAL',
    round_label: 'Regular Season',
    status: 'live',
    score1: 54,
    score2: 51,
    live_label: 'Q2 3:08',
  },
  {
    id: 'nba-5',
    kickoff_at: '2026-07-05T19:00:00.000Z',
    team1_name: 'New York Knicks',
    team2_name: 'Philadelphia 76ers',
    team1_code: 'NYK',
    team2_code: 'PHI',
    round_label: 'Regular Season',
    status: 'upcoming',
  },
]

const NFL_FIXTURES: MockFixture[] = [
  {
    id: 'nfl-1',
    kickoff_at: '2026-07-03T17:00:00.000Z',
    team1_name: 'Kansas City Chiefs',
    team2_name: 'Buffalo Bills',
    team1_code: 'KC',
    team2_code: 'BUF',
    round_label: 'Week 5',
    status: 'live',
    score1: 17,
    score2: 14,
    live_label: 'Q3 4:22',
  },
  {
    id: 'nfl-2',
    kickoff_at: '2026-07-03T20:25:00.000Z',
    team1_name: 'San Francisco 49ers',
    team2_name: 'Detroit Lions',
    team1_code: 'SF',
    team2_code: 'DET',
    round_label: 'Week 5',
    status: 'upcoming',
  },
  {
    id: 'nfl-3',
    kickoff_at: '2026-07-04T17:00:00.000Z',
    team1_name: 'Dallas Cowboys',
    team2_name: 'Philadelphia Eagles',
    team1_code: 'DAL',
    team2_code: 'PHI',
    round_label: 'Week 5',
    status: 'upcoming',
  },
  {
    id: 'nfl-4',
    kickoff_at: '2026-07-05T20:20:00.000Z',
    team1_name: 'Baltimore Ravens',
    team2_name: 'Cincinnati Bengals',
    team1_code: 'BAL',
    team2_code: 'CIN',
    round_label: 'Week 5',
    status: 'upcoming',
  },
]

const NHL_FIXTURES: MockFixture[] = [
  {
    id: 'nhl-1',
    kickoff_at: '2026-07-02T23:00:00.000Z',
    team1_name: 'Edmonton Oilers',
    team2_name: 'Florida Panthers',
    team1_code: 'EDM',
    team2_code: 'FLA',
    round_label: 'Stanley Cup Final',
    status: 'live',
    score1: 2,
    score2: 1,
    live_label: 'P2 12:40',
  },
  {
    id: 'nhl-2',
    kickoff_at: '2026-07-03T23:30:00.000Z',
    team1_name: 'New York Rangers',
    team2_name: 'Carolina Hurricanes',
    team1_code: 'NYR',
    team2_code: 'CAR',
    round_label: 'Conference Finals',
    status: 'upcoming',
  },
  {
    id: 'nhl-3',
    kickoff_at: '2026-07-04T19:00:00.000Z',
    team1_name: 'Vegas Golden Knights',
    team2_name: 'Dallas Stars',
    team1_code: 'VGK',
    team2_code: 'DAL',
    round_label: 'Conference Finals',
    status: 'upcoming',
  },
  {
    id: 'nhl-4',
    kickoff_at: '2026-07-06T00:00:00.000Z',
    team1_name: 'Toronto Maple Leafs',
    team2_name: 'Boston Bruins',
    team1_code: 'TOR',
    team2_code: 'BOS',
    round_label: 'Round 2',
    status: 'upcoming',
  },
]

const MLB_FIXTURES: MockFixture[] = [
  {
    id: 'mlb-1',
    kickoff_at: '2026-07-02T23:10:00.000Z',
    team1_name: 'New York Yankees',
    team2_name: 'Boston Red Sox',
    team1_code: 'NYY',
    team2_code: 'BOS',
    round_label: 'Regular Season',
    status: 'live',
    score1: 4,
    score2: 3,
    live_label: 'Bot 7th',
  },
  {
    id: 'mlb-2',
    kickoff_at: '2026-07-03T02:05:00.000Z',
    team1_name: 'Los Angeles Dodgers',
    team2_name: 'San Francisco Giants',
    team1_code: 'LAD',
    team2_code: 'SF',
    round_label: 'Regular Season',
    status: 'upcoming',
  },
  {
    id: 'mlb-3',
    kickoff_at: '2026-07-03T18:20:00.000Z',
    team1_name: 'Chicago Cubs',
    team2_name: 'St. Louis Cardinals',
    team1_code: 'CHC',
    team2_code: 'STL',
    round_label: 'Regular Season',
    status: 'upcoming',
  },
  {
    id: 'mlb-4',
    kickoff_at: '2026-07-04T19:10:00.000Z',
    team1_name: 'Houston Astros',
    team2_name: 'Texas Rangers',
    team1_code: 'HOU',
    team2_code: 'TEX',
    round_label: 'Regular Season',
    status: 'upcoming',
  },
  {
    id: 'mlb-5',
    kickoff_at: '2026-07-05T17:05:00.000Z',
    team1_name: 'Atlanta Braves',
    team2_name: 'Philadelphia Phillies',
    team1_code: 'ATL',
    team2_code: 'PHI',
    round_label: 'Regular Season',
    status: 'upcoming',
  },
]

const UFC_FIXTURES: MockFixture[] = [
  {
    id: 'ufc-1',
    kickoff_at: '2026-07-03T02:00:00.000Z',
    team1_name: 'Alex Pereira',
    team2_name: 'Israel Adesanya',
    team1_code: 'AP',
    team2_code: 'IA',
    round_label: 'Main Card',
    status: 'live',
    score1: 1,
    score2: 0,
    live_label: 'R2 2:15',
  },
  {
    id: 'ufc-2',
    kickoff_at: '2026-07-03T02:45:00.000Z',
    team1_name: 'Jon Jones',
    team2_name: 'Tom Aspinall',
    team1_code: 'JJ',
    team2_code: 'TA',
    round_label: 'Main Card',
    status: 'upcoming',
  },
  {
    id: 'ufc-3',
    kickoff_at: '2026-07-04T23:00:00.000Z',
    team1_name: 'Ilia Topuria',
    team2_name: 'Max Holloway',
    team1_code: 'IT',
    team2_code: 'MH',
    round_label: 'Co-Main',
    status: 'upcoming',
  },
  {
    id: 'ufc-4',
    kickoff_at: '2026-07-05T00:30:00.000Z',
    team1_name: 'Sean O\'Malley',
    team2_name: 'Merab Dvalishvili',
    team1_code: 'SO',
    team2_code: 'MD',
    round_label: 'Prelims',
    status: 'upcoming',
  },
]

const MOCK_FIXTURES_BY_SPORT: Record<string, MockFixture[]> = {
  nba: NBA_FIXTURES,
  nfl: NFL_FIXTURES,
  nhl: NHL_FIXTURES,
  mlb: MLB_FIXTURES,
  ufc: UFC_FIXTURES,
}

export function getMockFixturesForSport(sportId: string): MockFixture[] {
  return MOCK_FIXTURES_BY_SPORT[sportId] ?? []
}

export type MockFixtureWithSport = MockFixture & {
  sportId: string
  sportLabel: string
}

export function getAllMockFixtures(): MockFixtureWithSport[] {
  return MOCK_SPORT_EVENTS.filter(
    (event) => !event.real && event.id !== 'all',
  ).flatMap((event) =>
    getMockFixturesForSport(event.id).map((fixture) => ({
      ...fixture,
      sportId: event.id,
      sportLabel: event.label,
    })),
  )
}

export function groupMockFixturesByDay(
  fixtures: MockFixture[],
): Map<string, MockFixture[]> {
  const byDay = new Map<string, MockFixture[]>()
  for (const fixture of fixtures) {
    const dayKey = new Date(fixture.kickoff_at).toDateString()
    if (!byDay.has(dayKey)) byDay.set(dayKey, [])
    byDay.get(dayKey)!.push(fixture)
  }
  return byDay
}
