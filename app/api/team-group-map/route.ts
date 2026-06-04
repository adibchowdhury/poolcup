import { NextResponse } from 'next/server'
import { buildTeamToGroupMap } from '@/src/lib/world-cup-groups'

type StandingRow = {
  team: { name: string }
  group: string
}

export async function GET() {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API_FOOTBALL_KEY is not configured' },
      { status: 500 },
    )
  }

  try {
    const res = await fetch(
      'https://v3.football.api-sports.io/standings?league=1&season=2026',
      { headers: { 'x-apisports-key': apiKey }, next: { revalidate: 3600 } },
    )

    const raw = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch standings from API-Football' },
        { status: 502 },
      )
    }

    if (raw.errors && Object.keys(raw.errors).length > 0) {
      return NextResponse.json(
        { error: 'API-Football standings error', details: raw.errors },
        { status: 502 },
      )
    }

    const standingGroups = raw.response?.[0]?.league?.standings ?? []
    const rows: StandingRow[] = standingGroups.flat()

    const teamToGroup = buildTeamToGroupMap(rows)
    const teamToGroupRecord = Object.fromEntries(teamToGroup.entries())

    return NextResponse.json({ teamToGroup: teamToGroupRecord })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
