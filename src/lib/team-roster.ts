import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTeamApiIdFromLogoUrl } from '@/src/lib/team-logos'

export type TeamRosterPlayer = {
  apiId: number
  name: string
  photo: string | null
  number: number | null
  position: string | null
}

const POSITION_ORDER: Record<string, number> = {
  goalkeeper: 0,
  defender: 1,
  midfielder: 2,
  attacker: 3,
  forward: 3,
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function positionSortKey(position: string | null): number {
  if (!position) return 50
  return POSITION_ORDER[position.trim().toLowerCase()] ?? 40
}

function parseRosterRows(data: unknown): TeamRosterPlayer[] {
  if (!Array.isArray(data)) return []

  const players = data
    .map((item): TeamRosterPlayer | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const apiId = asNumber(row.api_id)
      const name = asString(row.name)?.trim()
      if (apiId == null || !name) return null

      return {
        apiId,
        name,
        photo: asString(row.photo)?.trim() || null,
        number: asNumber(row.number),
        position: asString(row.position)?.trim() || null,
      }
    })
    .filter((row): row is TeamRosterPlayer => row != null)

  return players.sort((a, b) => {
    const posDiff = positionSortKey(a.position) - positionSortKey(b.position)
    if (posDiff !== 0) return posDiff
    const numA = a.number ?? 999
    const numB = b.number ?? 999
    if (numA !== numB) return numA - numB
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

/** Direct select from public.team_players (public-read). */
export async function fetchTeamRoster(
  supabase: SupabaseClient,
  teamApiId: number,
): Promise<TeamRosterPlayer[]> {
  const { data, error } = await supabase
    .from('team_players')
    .select('api_id, name, photo, number, position')
    .eq('team_api_id', teamApiId)

  if (error) {
    console.error(
      `fetchTeamRoster(${teamApiId}) failed:`,
      error.message,
    )
    return []
  }

  return parseRosterRows(data)
}

export async function fetchRosterForTeamLogo(
  supabase: SupabaseClient,
  logoUrl: string | null | undefined,
): Promise<{ teamApiId: number | null; players: TeamRosterPlayer[] }> {
  const teamApiId = parseTeamApiIdFromLogoUrl(logoUrl)
  if (teamApiId == null) {
    return { teamApiId: null, players: [] }
  }

  const players = await fetchTeamRoster(supabase, teamApiId)
  return { teamApiId, players }
}

export function playerMonogram(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  const first = parts[0]![0] ?? ''
  const last = parts[parts.length - 1]![0] ?? ''
  return `${first}${last}`.toUpperCase()
}
