import { NextResponse } from 'next/server'
import { buildTeamToGroupMap } from '@/src/lib/world-cup-groups'

/** Group draw assignments are static; revalidate at most once per day. */
export const revalidate = 86400

const CACHE_SECONDS = 86400

type StandingRow = {
  team: { name: string }
  group: string
}

export async function GET() {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    console.error('team-group-map: API_FOOTBALL_KEY is not configured')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  try {
    const res = await fetch(
      'https://v3.football.api-sports.io/standings?league=1&season=2026',
      {
        headers: { 'x-apisports-key': apiKey },
        next: { revalidate: CACHE_SECONDS },
      },
    )

    const raw = await res.json()

    if (!res.ok) {
      console.error('team-group-map: API-Football HTTP error', {
        status: res.status,
        body: raw,
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 502 })
    }

    if (raw.errors && Object.keys(raw.errors).length > 0) {
      console.error('team-group-map: API-Football standings error', raw.errors)
      return NextResponse.json({ error: 'Internal server error' }, { status: 502 })
    }

    const standingGroups = raw.response?.[0]?.league?.standings ?? []
    const rows: StandingRow[] = standingGroups.flat()

    const teamToGroup = buildTeamToGroupMap(rows)
    const teamToGroupRecord = Object.fromEntries(teamToGroup.entries())

    return NextResponse.json(
      { teamToGroup: teamToGroupRecord },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
        },
      },
    )
  } catch (err) {
    console.error('team-group-map error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
