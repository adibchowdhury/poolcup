import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'

export type ProfileSportEntry = {
  id: string
  name: string
  iconSrc: string
  /** True when derived from the user's pool memberships. */
  derivedFromPools: boolean
}

/** Design-only mock sports — not persisted follow preferences. */
const MOCK_SPORTS_PREVIEW: Omit<ProfileSportEntry, 'derivedFromPools'>[] = [
  { id: 'basketball', name: 'Basketball', iconSrc: '/sports/basketball.png' },
  { id: 'football', name: 'Football', iconSrc: '/sports/football.png' },
  { id: 'hockey', name: 'Hockey', iconSrc: '/sports/hockey.png' },
]

function poolEventLooksLikeSoccer(eventName: string): boolean {
  const normalized = eventName.trim().toLowerCase()
  return (
    normalized.includes('world cup') ||
    normalized.includes('soccer') ||
    (normalized.includes('football') && normalized.includes('cup'))
  )
}

export function buildProfileSportsEntries(
  pools: DashboardPoolCardData[],
): ProfileSportEntry[] {
  const entries: ProfileSportEntry[] = []

  const hasSoccerPool = pools.some((pool) =>
    poolEventLooksLikeSoccer(pool.eventName),
  )

  if (hasSoccerPool) {
    entries.push({
      id: 'soccer',
      name: 'Soccer',
      iconSrc: '/sports/soccer.png',
      derivedFromPools: true,
    })
  }

  for (const mock of MOCK_SPORTS_PREVIEW) {
    entries.push({ ...mock, derivedFromPools: false })
  }

  return entries
}
