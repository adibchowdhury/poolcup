'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CompactMatchRow } from '@/components/predict/compact-match-row'
import { resolveTeamFlag } from '@/src/lib/team-flags'

const LANDING_GET_STARTED_HREF = '/login?next=/create'

/** Public API-Football crest URLs (same source as in-app team*_logo). */
const CREST = {
  arsenal: 'https://media.api-sports.io/football/teams/42.png',
  liverpool: 'https://media.api-sports.io/football/teams/40.png',
  manchesterCity: 'https://media.api-sports.io/football/teams/50.png',
  chelsea: 'https://media.api-sports.io/football/teams/49.png',
} as const

type ExampleMatch = {
  id: string
  homeName: string
  awayName: string
  homeLogo: string
  awayLogo: string
  kickoffAt: string
  initialHome: string
  initialAway: string
}

const EXAMPLE_MATCHES: ExampleMatch[] = [
  {
    id: 'landing-ars-liv',
    homeName: 'Arsenal',
    awayName: 'Liverpool',
    homeLogo: CREST.arsenal,
    awayLogo: CREST.liverpool,
    kickoffAt: '2030-06-15T15:00:00.000Z',
    initialHome: '2',
    initialAway: '1',
  },
  {
    id: 'landing-mci-che',
    homeName: 'Manchester City',
    awayName: 'Chelsea',
    homeLogo: CREST.manchesterCity,
    awayLogo: CREST.chelsea,
    kickoffAt: '2030-06-15T17:30:00.000Z',
    initialHome: '',
    initialAway: '',
  },
]

function ExampleMatchRow({ match }: { match: ExampleMatch }) {
  const [homeScore, setHomeScore] = useState(match.initialHome)
  const [awayScore, setAwayScore] = useState(match.initialAway)
  const filled = homeScore !== '' && awayScore !== ''

  return (
    <CompactMatchRow
      homeTeam={{
        name: match.homeName,
        flag: resolveTeamFlag(match.homeName),
        logoUrl: match.homeLogo,
      }}
      awayTeam={{
        name: match.awayName,
        flag: resolveTeamFlag(match.awayName),
        logoUrl: match.awayLogo,
      }}
      homeScore={homeScore}
      awayScore={awayScore}
      kickoffAt={match.kickoffAt}
      onHomeScoreChange={setHomeScore}
      onAwayScoreChange={setAwayScore}
      isPredicted={filled}
      variant="prominent"
    />
  )
}

/**
 * Landing preview of the real CompactMatchRow prediction UI.
 * Scores update local React state only — no auth, DB, or save calls.
 */
export function LandingMatchPredictionPreview() {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111a27] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] sm:p-6">
      <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-[#ffb300]/10 px-4 py-2 text-sm font-medium text-[#ffb300]">
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Matches lock in 2h
      </div>

      <div className="space-y-3">
        {EXAMPLE_MATCHES.map((match) => (
          <ExampleMatchRow key={match.id} match={match} />
        ))}
      </div>

      <Link
        href={LANDING_GET_STARTED_HREF}
        className="mt-4 flex w-full items-center justify-center rounded-lg bg-[#00e676] py-3 text-sm font-semibold text-[#080b0f] transition-colors hover:bg-[#00e676]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111a27]"
      >
        Save Predictions
      </Link>
    </div>
  )
}
