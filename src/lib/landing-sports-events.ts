/**
 * Landing “Every sport” section — editable sport → event catalogue.
 * Update names / team counts here; the UI reads this map only.
 */

export type LandingSportId =
  | 'soccer'
  | 'basketball'
  | 'football'
  | 'hockey'
  | 'baseball'
  | 'cricket'

export type LandingSportEvent = {
  id: string
  name: string
  /** Display string, e.g. "20 Teams" or "Coming soon". */
  teamsLabel: string
  /** Optional short blurb under the name. */
  blurb?: string
}

export type LandingSportDefinition = {
  id: LandingSportId
  label: string
  emoji: string
  /** Low-poly ball art under /public/sports */
  ballSrc: string
  /** Accent used for selector glow + card tint */
  accent: string
  accentRgb: string
  events: [LandingSportEvent, LandingSportEvent, LandingSportEvent]
}

export const LANDING_SPORTS: LandingSportDefinition[] = [
  {
    id: 'soccer',
    label: 'Soccer',
    emoji: '⚽',
    ballSrc: '/sports/soccer.png',
    accent: '#00e676',
    accentRgb: '0,230,118',
    events: [
      {
        id: 'premier-league',
        name: 'Premier League',
        teamsLabel: '20 Teams',
        blurb: 'England’s top flight',
      },
      {
        id: 'champions-league',
        name: 'Champions League',
        teamsLabel: '36 Teams',
        blurb: 'Europe’s elite',
      },
      {
        id: 'mls',
        name: 'MLS',
        teamsLabel: '29 Teams',
        blurb: 'North American club soccer',
      },
    ],
  },
  {
    id: 'basketball',
    label: 'Basketball',
    emoji: '🏀',
    ballSrc: '/sports/basketball.png',
    accent: '#f97316',
    accentRgb: '249,115,22',
    events: [
      {
        id: 'nba',
        name: 'NBA',
        teamsLabel: '30 Teams',
        blurb: 'The association',
      },
      {
        id: 'euroleague',
        name: 'EuroLeague',
        teamsLabel: '18 Teams',
        blurb: 'Europe’s top clubs',
      },
      {
        id: 'ncaa-basketball',
        name: 'NCAA Basketball',
        teamsLabel: 'Coming soon',
        blurb: 'March madness energy',
      },
    ],
  },
  {
    id: 'football',
    label: 'Football',
    emoji: '🏈',
    ballSrc: '/sports/football.png',
    accent: '#3b82f6',
    accentRgb: '59,130,246',
    events: [
      {
        id: 'nfl',
        name: 'NFL',
        teamsLabel: '32 Teams',
        blurb: 'Sunday football',
      },
      {
        id: 'ncaa-football',
        name: 'NCAA Football',
        teamsLabel: 'Coming soon',
        blurb: 'Campus rivalries',
      },
      {
        id: 'xfl-placeholder',
        name: 'Spring Football',
        teamsLabel: 'Coming soon',
        blurb: 'More leagues on the way',
      },
    ],
  },
  {
    id: 'hockey',
    label: 'Hockey',
    emoji: '🏒',
    ballSrc: '/sports/hockey.png',
    accent: '#22d3ee',
    accentRgb: '34,211,238',
    events: [
      {
        id: 'nhl',
        name: 'NHL',
        teamsLabel: '32 Teams',
        blurb: 'The big ice',
      },
      {
        id: 'iihf',
        name: 'IIHF Worlds',
        teamsLabel: 'Coming soon',
        blurb: 'International play',
      },
      {
        id: 'ahl-placeholder',
        name: 'AHL',
        teamsLabel: 'Coming soon',
        blurb: 'Prospects & depth',
      },
    ],
  },
  {
    id: 'baseball',
    label: 'Baseball',
    emoji: '⚾',
    ballSrc: '/sports/baseball.png',
    accent: '#ef4444',
    accentRgb: '239,68,68',
    events: [
      {
        id: 'mlb',
        name: 'MLB',
        teamsLabel: '30 Teams',
        blurb: 'America’s pastime',
      },
      {
        id: 'wbc',
        name: 'World Baseball Classic',
        teamsLabel: 'Coming soon',
        blurb: 'National squads',
      },
      {
        id: 'npb-placeholder',
        name: 'NPB',
        teamsLabel: 'Coming soon',
        blurb: 'Japan’s top league',
      },
    ],
  },
  {
    id: 'cricket',
    label: 'Cricket',
    emoji: '🏏',
    ballSrc: '/sports/cricket.png',
    accent: '#f59e0b',
    accentRgb: '245,158,11',
    events: [
      {
        id: 'ipl',
        name: 'IPL',
        teamsLabel: 'Coming soon',
        blurb: 'T20 fireworks',
      },
      {
        id: 'icc-world-cup',
        name: 'ICC World Cup',
        teamsLabel: 'Coming soon',
        blurb: 'The biggest stage',
      },
      {
        id: 'the-ashes',
        name: 'The Ashes',
        teamsLabel: 'Coming soon',
        blurb: 'ENG vs AUS',
      },
    ],
  },
]

export const LANDING_SPORTS_DEFAULT_ID: LandingSportId = 'soccer'

/** Per-card glow accents (slot 0–2) so the three cards stay colorful. */
export const LANDING_EVENT_CARD_GLOWS = [
  { glow: '#00e676', glowRgb: '0,230,118' },
  { glow: '#3b82f6', glowRgb: '59,130,246' },
  { glow: '#f59e0b', glowRgb: '245,158,11' },
] as const

export function getLandingSport(
  id: LandingSportId,
): LandingSportDefinition {
  return (
    LANDING_SPORTS.find((sport) => sport.id === id) ?? LANDING_SPORTS[0]!
  )
}
