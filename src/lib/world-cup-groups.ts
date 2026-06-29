export const WORLD_CUP_GROUP_LETTERS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
] as const

export type WorldCupGroupLetter = (typeof WORLD_CUP_GROUP_LETTERS)[number]

export type GroupRankings = Record<string, string[]>

export type WorldCupGroup = {
  letter: WorldCupGroupLetter
  teams: string[]
}

export type GroupStageMatch = {
  round: string
  group_name: string | null
  team1_name: string
  team2_name: string
  kickoff_at?: string
  locked_at?: string | null
}

/** Parse group letter from DB value (e.g. "A") or label (e.g. "Group A"). Rejects bad values like "S" from "Group Stage". */
export function parseGroupLetter(
  groupName: string | null | undefined,
): WorldCupGroupLetter | null {
  if (!groupName) return null

  const trimmed = groupName.trim().toUpperCase()
  if (/^[A-L]$/.test(trimmed)) {
    return trimmed as WorldCupGroupLetter
  }

  const fromLabel = trimmed.match(/GROUP\s+([A-L])\b/)
  if (fromLabel) {
    return fromLabel[1] as WorldCupGroupLetter
  }

  return null
}

export function isGroupStageRound(round: string): boolean {
  return round.trim().toLowerCase() === 'group'
}

/** Map API-Football league.round to our matches.round + group_name (shared with seed script). */
export function mapLeagueRoundToGroup(leagueRound: string): {
  round: string
  group_name: string | null
} {
  const label = leagueRound.trim()

  const groupLetterMatch = label.match(/Group\s+([A-L])\b/i)
  if (groupLetterMatch) {
    return { round: 'group', group_name: groupLetterMatch[1].toUpperCase() }
  }

  const ROUND_LABEL_MAP: Record<string, string> = {
    'Group Stage': 'group',
    'Round of 32': 'r32',
    'Round of 16': 'r16',
    'Quarter-finals': 'qf',
    'Semi-finals': 'sf',
    Final: 'final',
  }

  for (const [apiLabel, round] of Object.entries(ROUND_LABEL_MAP)) {
    if (label.includes(apiLabel)) {
      return { round, group_name: null }
    }
  }

  return { round: 'group', group_name: null }
}

export function resolveMatchGroupLetter(
  match: GroupStageMatch,
  teamToGroup?: Map<string, WorldCupGroupLetter>,
): WorldCupGroupLetter | null {
  const fromField = parseGroupLetter(match.group_name)
  if (fromField) return fromField

  if (!teamToGroup) return null

  const homeGroup = teamToGroup.get(match.team1_name)
  const awayGroup = teamToGroup.get(match.team2_name)
  if (homeGroup && awayGroup && homeGroup === awayGroup) return homeGroup
  return homeGroup ?? awayGroup ?? null
}

export function buildTeamToGroupMap(
  standingRows: Array<{ team: { name: string }; group: string }>,
): Map<string, WorldCupGroupLetter> {
  const map = new Map<string, WorldCupGroupLetter>()

  for (const row of standingRows) {
    const letter = parseGroupLetter(row.group)
    if (!letter) continue
    map.set(row.team.name, letter)
  }

  return map
}

export function buildWorldCupGroups(
  matches: GroupStageMatch[],
  teamToGroup?: Map<string, WorldCupGroupLetter>,
): WorldCupGroup[] {
  const teamSets = new Map<string, Set<string>>()

  for (const match of matches) {
    if (!isGroupStageRound(match.round)) continue

    const letter = resolveMatchGroupLetter(match, teamToGroup)
    if (!letter) continue

    if (!teamSets.has(letter)) teamSets.set(letter, new Set())
    teamSets.get(letter)!.add(match.team1_name)
    teamSets.get(letter)!.add(match.team2_name)
  }

  return WORLD_CUP_GROUP_LETTERS.map((letter) => ({
    letter,
    teams: [...(teamSets.get(letter) ?? [])].sort((a, b) =>
      a.localeCompare(b),
    ),
  }))
}

export function emptyGroupRankings(): GroupRankings {
  return Object.fromEntries(
    WORLD_CUP_GROUP_LETTERS.map((letter) => [letter, [] as string[]]),
  )
}

export function parseStandingsJson(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function isGroupRankingComplete(standings: string[], teamCount = 4): boolean {
  return standings.length === teamCount
}

export function countCompleteGroups(
  rankings: GroupRankings,
  groups: WorldCupGroup[],
): number {
  return groups.filter((group) =>
    isGroupRankingComplete(rankings[group.letter] ?? [], group.teams.length),
  ).length
}

export function getTeamRank(
  standings: string[],
  teamName: string,
): number | null {
  const index = standings.indexOf(teamName)
  return index >= 0 ? index + 1 : null
}

export function tapTeamInGroup(
  standings: string[],
  teamName: string,
  teamsInGroup: string[],
): string[] {
  if (!teamsInGroup.includes(teamName)) return standings

  const existingIndex = standings.indexOf(teamName)
  if (existingIndex >= 0) {
    return standings.slice(0, existingIndex)
  }

  if (standings.length >= teamsInGroup.length) return standings
  return [...standings, teamName]
}

/** After a group tap, assign the sole remaining team to 4th when 3 of 4 are ranked. */
export function tapGroupTeamWithAutoFourth(
  standings: string[],
  teamName: string,
  teamsInGroup: string[],
): string[] {
  const afterTap = tapTeamInGroup(standings, teamName, teamsInGroup)
  if (teamsInGroup.length !== 4 || afterTap.length !== 3) return afterTap

  const remaining = teamsInGroup.filter((team) => !afterTap.includes(team))
  if (remaining.length !== 1) return afterTap

  return tapTeamInGroup(afterTap, remaining[0]!, teamsInGroup)
}

export function clearGroupRankings(): string[] {
  return []
}

export function rankingsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((team, index) => team === b[index])
}

/** Earliest kickoff (ms) per group from loaded group-stage matches. */
export function buildGroupFirstKickoffs(
  matches: GroupStageMatch[],
  teamToGroup?: Map<string, WorldCupGroupLetter>,
): Map<WorldCupGroupLetter, number> {
  const firstKickoff = new Map<WorldCupGroupLetter, number>()

  for (const match of matches) {
    if (!isGroupStageRound(match.round) || !match.kickoff_at) continue

    const letter = resolveMatchGroupLetter(match, teamToGroup)
    if (!letter) continue

    const kickoffMs = new Date(match.kickoff_at).getTime()
    if (Number.isNaN(kickoffMs)) continue

    const existing = firstKickoff.get(letter)
    if (existing === undefined || kickoffMs < existing) {
      firstKickoff.set(letter, kickoffMs)
    }
  }

  return firstKickoff
}

/** Latest kickoff (ms) among all group-stage matches (A–L). */
export function getLatestGroupStageKickoffMs(
  matches: GroupStageMatch[],
  teamToGroup?: Map<string, WorldCupGroupLetter>,
): number | undefined {
  let latestKickoff: number | undefined

  for (const match of matches) {
    if (!isGroupStageRound(match.round) || !match.kickoff_at) continue

    const letter = resolveMatchGroupLetter(match, teamToGroup)
    if (!letter) continue

    const kickoffMs = new Date(match.kickoff_at).getTime()
    if (Number.isNaN(kickoffMs)) continue

    if (latestKickoff === undefined || kickoffMs > latestKickoff) {
      latestKickoff = kickoffMs
    }
  }

  return latestKickoff
}

/** A group locks when its first match has kicked off (now >= earliest kickoff_at). */
export function isGroupRankingLocked(
  groupLetter: WorldCupGroupLetter,
  matches: GroupStageMatch[],
  now = Date.now(),
  teamToGroup?: Map<string, WorldCupGroupLetter>,
): boolean {
  const kickoffMs = buildGroupFirstKickoffs(matches, teamToGroup).get(groupLetter)
  if (kickoffMs === undefined) return false
  return now >= kickoffMs
}

export const THIRD_PLACE_LOCKED_LABEL = 'Locked — group stage finished'

/** Third-place picks lock once the last group-stage match has kicked off. */
export function isThirdPlaceRankingLocked(
  matches: GroupStageMatch[],
  now = Date.now(),
  teamToGroup?: Map<string, WorldCupGroupLetter>,
): boolean {
  const latestKickoffMs = getLatestGroupStageKickoffMs(matches, teamToGroup)
  if (latestKickoffMs === undefined) return false
  return now >= latestKickoffMs
}

/** Merge saved standings with default team list for display ordering. */
export function getGroupDisplayOrder(
  teams: string[],
  standings: string[],
): string[] {
  if (teams.length === 0) return []

  const validStandings = standings.filter((team) => teams.includes(team))
  const unranked = teams.filter((team) => !validStandings.includes(team))

  if (validStandings.length === teams.length) {
    return validStandings
  }

  return [...validStandings, ...unranked]
}

export function reorderTeamsInGroup(
  order: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length
  ) {
    return order
  }

  const next = [...order]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved!)
  return next
}

export function cloneGroupRankings(rankings: GroupRankings): GroupRankings {
  return Object.fromEntries(
    Object.entries(rankings).map(([letter, standings]) => [
      letter,
      [...standings],
    ]),
  )
}

export type ThirdPlaceSlot = {
  group: WorldCupGroupLetter
  team: string | null
}

/** Third-place finisher from each group in A–L order. */
export function getThirdPlaceSlots(
  groupRankings: GroupRankings,
): ThirdPlaceSlot[] {
  return WORLD_CUP_GROUP_LETTERS.map((group) => ({
    group,
    team: groupRankings[group]?.[2] ?? null,
  }))
}

/** Team names for groups that have a 3rd-place selection (A–L order). */
export function getAvailableThirdPlaceTeams(
  groupRankings: GroupRankings,
): string[] {
  return getThirdPlaceSlots(groupRankings)
    .map((slot) => slot.team)
    .filter((team): team is string => team !== null)
}

/** Third-place teams the user picks to advance out of 12 group runners-up. */
export const REQUIRED_THIRD_PLACE_ADVANCING = 8

/** Dashboard progress: 12 group rankings + 8 third-place advancing picks. */
export const WINNER_ONLY_DASHBOARD_PROGRESS_TOTAL = 12 + REQUIRED_THIRD_PLACE_ADVANCING

export function computeWinnerOnlyDashboardProgress(
  groupStandingsRows: string[][],
  thirdPlaceRankings: string[],
): number {
  const completeGroups = groupStandingsRows.filter((standings) =>
    isGroupRankingComplete(standings, 4),
  ).length
  const thirdPlaceAdvancing = Math.min(
    thirdPlaceRankings.length,
    REQUIRED_THIRD_PLACE_ADVANCING,
  )
  return completeGroups + thirdPlaceAdvancing
}

function fillRemainingThirdPlaceTeams(
  rankings: string[],
  availableTeams: string[],
): string[] {
  let result = rankings
  for (const team of availableTeams) {
    if (!result.includes(team)) {
      result = tapTeamInGroup(result, team, availableTeams)
    }
  }
  return result
}

/** Keep at most 8 advancing picks; when 8 are chosen, append the rest as eliminated. */
export function normalizeThirdPlaceRankings(
  rankings: string[],
  availableTeams: string[],
): string[] {
  if (availableTeams.length === 0) return []

  const availableSet = new Set(availableTeams)
  let valid = rankings.filter((team) => availableSet.has(team))

  if (valid.length > REQUIRED_THIRD_PLACE_ADVANCING) {
    valid = valid.slice(0, REQUIRED_THIRD_PLACE_ADVANCING)
  }

  if (valid.length === REQUIRED_THIRD_PLACE_ADVANCING) {
    return fillRemainingThirdPlaceTeams(valid, availableTeams)
  }

  return valid
}

/** After a third-place tap, auto-assign unranked teams as eliminated once 8 advance. */
export function tapThirdPlaceTeamWithAutoEliminated(
  rankings: string[],
  teamName: string,
  availableTeams: string[],
): string[] {
  const afterTap = tapTeamInGroup(rankings, teamName, availableTeams)
  return normalizeThirdPlaceRankings(afterTap, availableTeams)
}

/** Drop rankings for teams no longer 3rd in any group. */
export function syncThirdPlaceRankings(
  rankings: string[],
  groupRankings: GroupRankings,
): string[] {
  const available = getAvailableThirdPlaceTeams(groupRankings)
  const filtered = rankings.filter((team) => available.includes(team))
  return normalizeThirdPlaceRankings(filtered, available)
}

export function parseThirdPlaceRankingsJson(value: unknown): string[] {
  return parseStandingsJson(value)
}
