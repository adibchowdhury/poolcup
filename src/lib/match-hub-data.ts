import type { SupabaseClient } from '@supabase/supabase-js'
import type { MyMatchPredictions } from '@/src/lib/my-match-predictions'
import { formatScoringStyleLabel } from '@/src/lib/scoring-style-display'

/** Set true only for local match-hub design preview (fake consensus/pools). */
export const USE_MOCK_HUB = false

export type MatchEventInfo = {
  id: string
  name: string
  sport: string | null
}

export type MatchConsensus = {
  homePct: number
  drawPct: number
  awayPct: number
  total: number
}

export type MatchCommonScore = {
  score: string
  team1: number | null
  team2: number | null
  count: number
  pct: number
}

export type FriendMatchPrediction = {
  userId: string
  displayName: string
  avatar: string | null
  customAvatarUrl: string | null
  predTeam1: number | null
  predTeam2: number | null
}

export type MatchRelatedPool = {
  id: string
  name: string
  inviteCode: string
  eventName: string
  scoringStyle: string
  members: number
  memberId: string
  isYours: boolean
  yourRank: number | null
  yourPoints: number | null
}

export type TeamFormResult = 'W' | 'D' | 'L'

export type TeamFormEntry = {
  result: TeamFormResult
  opponent: string | null
  scoreLabel: string | null
  kickoffAt: string | null
}

export type HeadToHeadMeeting = {
  kickoffAt: string | null
  team1Name: string
  team2Name: string
  resultTeam1: number | null
  resultTeam2: number | null
  winnerLabel: string | null
}

export type HeadToHeadData = {
  team1Wins: number
  draws: number
  team2Wins: number
  meetings: HeadToHeadMeeting[]
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

function parseScoreParts(
  score: string,
): { team1: number; team2: number } | null {
  const match = score.trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/)
  if (!match) return null
  return {
    team1: Number.parseInt(match[1]!, 10),
    team2: Number.parseInt(match[2]!, 10),
  }
}

export async function fetchMatchEventInfo(
  supabase: SupabaseClient,
  eventId: string | null | undefined,
): Promise<MatchEventInfo | null> {
  if (!eventId) return null

  const { data, error } = await supabase
    .from('sporting_events')
    .select('id, name, sport')
    .eq('id', eventId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load sporting event:', error.message)
    return null
  }

  if (!data) return null

  return {
    id: data.id as string,
    name: (data.name as string) || 'Competition',
    sport: (data.sport as string | null) ?? null,
  }
}

export function parseMatchConsensus(data: unknown): MatchConsensus | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>

  const homePct =
    asNumber(row.home_pct) ??
    asNumber(row.homePct) ??
    asNumber(row.team1_pct)
  const drawPct = asNumber(row.draw_pct) ?? asNumber(row.drawPct)
  const awayPct =
    asNumber(row.away_pct) ??
    asNumber(row.awayPct) ??
    asNumber(row.team2_pct)
  const total = asNumber(row.total) ?? asNumber(row.prediction_count)

  if (
    homePct == null ||
    drawPct == null ||
    awayPct == null ||
    total == null
  ) {
    return null
  }

  return { homePct, drawPct, awayPct, total }
}

export function parseMatchCommonScores(data: unknown): MatchCommonScore[] {
  if (!Array.isArray(data)) return []

  return data
    .map((item): MatchCommonScore | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const count = asNumber(row.cnt) ?? asNumber(row.count)
      const pct = asNumber(row.pct) ?? asNumber(row.percent)
      let score = asString(row.score)
      let team1 = asNumber(row.team1) ?? asNumber(row.pred_team1)
      let team2 = asNumber(row.team2) ?? asNumber(row.pred_team2)

      if (!score && team1 != null && team2 != null) {
        score = `${team1}–${team2}`
      }
      if (score && (team1 == null || team2 == null)) {
        const parts = parseScoreParts(score)
        if (parts) {
          team1 = parts.team1
          team2 = parts.team2
          score = `${parts.team1}–${parts.team2}`
        }
      }
      if (!score || count == null || pct == null) return null
      return { score, team1, team2, count, pct }
    })
    .filter((row): row is MatchCommonScore => row != null)
}

export function parseFriendsMatchPredictions(
  data: unknown,
): FriendMatchPrediction[] {
  if (!Array.isArray(data)) return []

  return data
    .map((item): FriendMatchPrediction | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const userId = asString(row.user_id) ?? asString(row.userId)
      if (!userId) return null
      return {
        userId,
        displayName:
          asString(row.display_name)?.trim() ||
          asString(row.displayName)?.trim() ||
          'Friend',
        avatar: asString(row.avatar),
        customAvatarUrl:
          asString(row.custom_avatar_url) ?? asString(row.customAvatarUrl),
        predTeam1: asNumber(row.pred_team1) ?? asNumber(row.predTeam1),
        predTeam2: asNumber(row.pred_team2) ?? asNumber(row.predTeam2),
      }
    })
    .filter((row): row is FriendMatchPrediction => row != null)
}

export async function fetchMatchConsensus(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchConsensus | null> {
  for (const args of [{ p_match_id: matchId }, { match_id: matchId }] as const) {
    const { data, error } = await supabase.rpc('get_match_consensus', args)
    if (!error) return parseMatchConsensus(data)
    console.error('get_match_consensus failed:', error.message)
  }
  return null
}

export async function fetchMatchCommonScores(
  supabase: SupabaseClient,
  matchId: string,
  limit = 3,
): Promise<MatchCommonScore[]> {
  for (const args of [
    { p_match_id: matchId, p_limit: limit },
    { match_id: matchId, limit },
  ] as const) {
    const { data, error } = await supabase.rpc('get_match_common_scores', args)
    if (!error) return parseMatchCommonScores(data).slice(0, limit)
    console.error('get_match_common_scores failed:', error.message)
  }
  return []
}

export async function fetchFriendsMatchPredictions(
  supabase: SupabaseClient,
  matchId: string,
): Promise<FriendMatchPrediction[]> {
  for (const args of [{ p_match_id: matchId }, { match_id: matchId }] as const) {
    const { data, error } = await supabase.rpc(
      'get_friends_match_predictions',
      args,
    )
    if (!error) return parseFriendsMatchPredictions(data)
    console.error('get_friends_match_predictions failed:', error.message)
  }
  return []
}

function normalizeFormResult(raw: unknown): TeamFormResult | null {
  if (typeof raw === 'string') {
    const value = raw.trim().toUpperCase()
    if (value === 'W' || value === 'WIN' || value === 'WON') return 'W'
    if (value === 'D' || value === 'DRAW' || value === 'TIE') return 'D'
    if (value === 'L' || value === 'LOSS' || value === 'LOST') return 'L'
  }
  return null
}

export function parseTeamForm(data: unknown): TeamFormEntry[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)
      ? ((data as { results: unknown[] }).results ?? [])
      : data && typeof data === 'object' && Array.isArray((data as { form?: unknown }).form)
        ? ((data as { form: unknown[] }).form ?? [])
        : []

  return rows
    .map((item): TeamFormEntry | null => {
      if (typeof item === 'string') {
        const result = normalizeFormResult(item)
        return result
          ? { result, opponent: null, scoreLabel: null, kickoffAt: null }
          : null
      }
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const result =
        normalizeFormResult(row.result) ??
        normalizeFormResult(row.outcome) ??
        normalizeFormResult(row.form)
      if (!result) return null

      const score1 = asNumber(row.result_team1) ?? asNumber(row.score1)
      const score2 = asNumber(row.result_team2) ?? asNumber(row.score2)
      const scoreLabel =
        asString(row.score) ??
        (score1 != null && score2 != null ? `${score1}–${score2}` : null)

      return {
        result,
        opponent:
          asString(row.opponent) ??
          asString(row.opponent_name) ??
          asString(row.against),
        scoreLabel,
        kickoffAt: asString(row.kickoff_at) ?? asString(row.played_at),
      }
    })
    .filter((row): row is TeamFormEntry => row != null)
}

export async function fetchTeamForm(
  supabase: SupabaseClient,
  teamName: string,
  limit = 5,
): Promise<TeamFormEntry[]> {
  for (const args of [
    { p_team_name: teamName, p_limit: limit },
    { team_name: teamName, limit },
  ] as const) {
    const { data, error } = await supabase.rpc('get_team_form', args)
    if (!error) return parseTeamForm(data).slice(0, limit)
    console.error('get_team_form failed:', error.message)
  }
  return []
}

export function parseHeadToHead(
  data: unknown,
  team1Name: string,
  team2Name: string,
): HeadToHeadData | null {
  if (!data || typeof data !== 'object') {
    if (Array.isArray(data)) {
      return parseHeadToHead(
        { meetings: data, team1_wins: 0, draws: 0, team2_wins: 0 },
        team1Name,
        team2Name,
      )
    }
    return null
  }

  const row = data as Record<string, unknown>
  const meetingsRaw = Array.isArray(row.meetings)
    ? row.meetings
    : Array.isArray(row.matches)
      ? row.matches
      : Array.isArray(row.results)
        ? row.results
        : []

  const meetings = meetingsRaw
    .map((item): HeadToHeadMeeting | null => {
      if (!item || typeof item !== 'object') return null
      const m = item as Record<string, unknown>
      const t1 =
        asString(m.team1_name) ??
        asString(m.home_name) ??
        asString(m.team1) ??
        team1Name
      const t2 =
        asString(m.team2_name) ??
        asString(m.away_name) ??
        asString(m.team2) ??
        team2Name
      const r1 = asNumber(m.result_team1) ?? asNumber(m.home_score) ?? asNumber(m.score1)
      const r2 = asNumber(m.result_team2) ?? asNumber(m.away_score) ?? asNumber(m.score2)

      let winnerLabel = asString(m.winner_label) ?? asString(m.winner)
      if (!winnerLabel && r1 != null && r2 != null) {
        if (r1 > r2) winnerLabel = t1
        else if (r2 > r1) winnerLabel = t2
        else winnerLabel = 'Draw'
      }

      return {
        kickoffAt: asString(m.kickoff_at) ?? asString(m.played_at) ?? asString(m.date),
        team1Name: t1 || team1Name,
        team2Name: t2 || team2Name,
        resultTeam1: r1,
        resultTeam2: r2,
        winnerLabel,
      }
    })
    .filter((item): item is HeadToHeadMeeting => item != null)

  let team1Wins =
    asNumber(row.team1_wins) ??
    asNumber(row.home_wins) ??
    asNumber(row.wins_team1) ??
    0
  let draws = asNumber(row.draws) ?? asNumber(row.draw) ?? 0
  let team2Wins =
    asNumber(row.team2_wins) ??
    asNumber(row.away_wins) ??
    asNumber(row.wins_team2) ??
    0

  if (
    team1Wins === 0 &&
    draws === 0 &&
    team2Wins === 0 &&
    meetings.length > 0
  ) {
    for (const meeting of meetings) {
      if (meeting.resultTeam1 == null || meeting.resultTeam2 == null) continue
      if (meeting.resultTeam1 > meeting.resultTeam2) {
        if (meeting.team1Name === team1Name) team1Wins += 1
        else team2Wins += 1
      } else if (meeting.resultTeam2 > meeting.resultTeam1) {
        if (meeting.team2Name === team2Name) team2Wins += 1
        else team1Wins += 1
      } else {
        draws += 1
      }
    }
  }

  return { team1Wins, draws, team2Wins, meetings }
}

export async function fetchHeadToHead(
  supabase: SupabaseClient,
  team1Name: string,
  team2Name: string,
  limit = 5,
): Promise<HeadToHeadData | null> {
  for (const args of [
    { p_team1: team1Name, p_team2: team2Name, p_limit: limit },
    { team1: team1Name, team2: team2Name, limit },
  ] as const) {
    const { data, error } = await supabase.rpc('get_head_to_head', args)
    if (!error) {
      const parsed = parseHeadToHead(data, team1Name, team2Name)
      if (!parsed) return null
      return {
        ...parsed,
        meetings: parsed.meetings.slice(0, limit),
      }
    }
    console.error('get_head_to_head failed:', error.message)
  }
  return null
}

type MembershipRow = {
  id: string
  pool_id: string
  pools: {
    id: string
    name: string
    invite_code: string
    event_id: string | null
    event_name: string | null
    scoring_style: string
    is_public?: boolean | null
    is_official?: boolean | null
  } | null
}

export function writableScorePoolsFromCompetition(
  pools: MatchRelatedPool[],
): Array<{ poolId: string; memberId: string; inviteCode: string }> {
  return pools
    .filter(
      (pool) =>
        pool.isYours &&
        Boolean(pool.memberId) &&
        (pool.scoringStyle === 'classic' || pool.scoringStyle === 'exact'),
    )
    .map((pool) => ({
      poolId: pool.id,
      memberId: pool.memberId,
      inviteCode: pool.inviteCode,
    }))
}

export async function fetchWritableScorePoolsForMatch(
  supabase: SupabaseClient,
  userId: string,
  eventId: string | null | undefined,
): Promise<Array<{ poolId: string; memberId: string; inviteCode: string }>> {
  const pools = await fetchMatchCompetitionPools(supabase, userId, eventId)
  return writableScorePoolsFromCompetition(pools)
}

/** Pools for this match's event; user's pools flagged + ranked from leaderboard_cache. */
export async function fetchMatchCompetitionPools(
  supabase: SupabaseClient,
  userId: string | null,
  eventId: string | null | undefined,
): Promise<MatchRelatedPool[]> {
  if (!eventId) return []

  const poolById = new Map<string, MatchRelatedPool>()

  if (userId) {
    const { data, error } = await supabase
      .from('pool_members')
      .select(
        `
        id,
        pool_id,
        pools (
          id,
          name,
          invite_code,
          event_id,
          event_name,
          scoring_style,
          is_public,
          is_official
        )
      `,
      )
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to load user pools for match:', error.message)
    } else {
      for (const row of (data ?? []) as unknown as MembershipRow[]) {
        const pool = row.pools
        if (!pool || pool.event_id !== eventId) continue
        poolById.set(pool.id, {
          id: pool.id,
          name: pool.name,
          inviteCode: pool.invite_code,
          eventName: pool.event_name?.trim() || 'Competition',
          scoringStyle: pool.scoring_style,
          members: 0,
          memberId: row.id,
          isYours: true,
          yourRank: null,
          yourPoints: null,
        })
      }
    }
  }

  const { data: publicPools, error: publicError } = await supabase
    .from('pools')
    .select(
      'id, name, invite_code, event_id, event_name, scoring_style, is_public, is_official',
    )
    .eq('event_id', eventId)
    .or('is_public.eq.true,is_official.eq.true')
    .limit(40)

  if (publicError) {
    console.error('Failed to load public pools for match:', publicError.message)
  } else {
    for (const pool of publicPools ?? []) {
      const id = pool.id as string
      if (poolById.has(id)) continue
      poolById.set(id, {
        id,
        name: pool.name as string,
        inviteCode: pool.invite_code as string,
        eventName: ((pool.event_name as string | null) ?? '').trim() || 'Competition',
        scoringStyle: pool.scoring_style as string,
        members: 0,
        memberId: '',
        isYours: false,
        yourRank: null,
        yourPoints: null,
      })
    }
  }

  const pools = [...poolById.values()]
  if (pools.length === 0) return []

  const poolIds = pools.map((pool) => pool.id)
  const { data: memberRows } = await supabase
    .from('pool_members')
    .select('pool_id')
    .in('pool_id', poolIds)

  const counts = new Map<string, number>()
  for (const row of memberRows ?? []) {
    const poolId = (row as { pool_id: string }).pool_id
    counts.set(poolId, (counts.get(poolId) ?? 0) + 1)
  }

  const yours = pools.filter((pool) => pool.isYours && pool.memberId)
  if (yours.length > 0) {
    const { data: ranks } = await supabase
      .from('leaderboard_cache')
      .select('pool_id, member_id, rank, total_points')
      .in(
        'pool_id',
        yours.map((pool) => pool.id),
      )
      .in(
        'member_id',
        yours.map((pool) => pool.memberId),
      )

    const rankByKey = new Map<string, { rank: number | null; points: number | null }>()
    for (const row of ranks ?? []) {
      rankByKey.set(`${row.pool_id}:${row.member_id}`, {
        rank: asNumber(row.rank),
        points: asNumber(row.total_points),
      })
    }

    for (const pool of pools) {
      if (!pool.isYours) continue
      const hit = rankByKey.get(`${pool.id}:${pool.memberId}`)
      if (hit) {
        pool.yourRank = hit.rank
        pool.yourPoints = hit.points
      }
    }
  }

  return pools
    .map((pool) => ({
      ...pool,
      members: counts.get(pool.id) ?? pool.members,
    }))
    .sort((a, b) => {
      if (a.isYours !== b.isYours) return a.isYours ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
}

export function formatPoolScoringLabel(scoringStyle: string): string {
  return formatScoringStyleLabel(scoringStyle)
}

/** TEMPORARY — frontend-only mock hub payload. Never written to the DB. */
export type MatchHubMockBundle = {
  consensus: MatchConsensus
  commonScores: MatchCommonScore[]
  friends: FriendMatchPrediction[]
  myPredictions: MyMatchPredictions
  writablePools: Array<{ poolId: string; memberId: string; inviteCode: string }>
  competitionPools: MatchRelatedPool[]
  team1Form: TeamFormEntry[]
  team2Form: TeamFormEntry[]
  headToHead: HeadToHeadData
}

function mockForm(results: TeamFormResult[]): TeamFormEntry[] {
  return results.map((result) => ({
    result,
    opponent: null,
    scoreLabel: null,
    kickoffAt: null,
  }))
}

/** TEMPORARY — realistic filled hub for design preview (e.g. New England vs Houston). */
export function buildMockMatchHub(
  team1Name: string,
  team2Name: string,
): MatchHubMockBundle {
  const home = team1Name.trim() || 'New England'
  const away = team2Name.trim() || 'Houston Dynamo'

  return {
    consensus: {
      homePct: 48,
      drawPct: 24,
      awayPct: 28,
      total: 14_820,
    },
    commonScores: [
      { score: '2–1', team1: 2, team2: 1, count: 2668, pct: 18 },
      { score: '1–1', team1: 1, team2: 1, count: 2223, pct: 15 },
      { score: '1–0', team1: 1, team2: 0, count: 1630, pct: 11 },
    ],
    friends: [
      {
        userId: 'mock-friend-alex',
        displayName: 'Alex Rivera',
        avatar: 'goal_keeper.png',
        customAvatarUrl: null,
        predTeam1: 2,
        predTeam2: 1,
      },
      {
        userId: 'mock-friend-jordan',
        displayName: 'Jordan Lee',
        avatar: 'cheerleader.png',
        customAvatarUrl: null,
        predTeam1: 1,
        predTeam2: 1,
      },
      {
        userId: 'mock-friend-sam',
        displayName: 'Sam Okonkwo',
        avatar: 'brown_skin_avatar.png',
        customAvatarUrl: null,
        predTeam1: 1,
        predTeam2: 0,
      },
      {
        userId: 'mock-friend-casey',
        displayName: 'Casey Nguyen',
        avatar: 'white_skin_avatar_girl.png',
        customAvatarUrl: null,
        predTeam1: 2,
        predTeam2: 0,
      },
    ],
    myPredictions: {
      has_prediction: true,
      pool_count: 2,
      distinct_count: 1,
      picks: [{ team1: 2, team2: 1, pool_count: 2 }],
    },
    writablePools: [
      {
        poolId: 'mock-pool-your',
        memberId: 'mock-member-your',
        inviteCode: 'MOCKNE',
      },
    ],
    competitionPools: [
      {
        id: 'mock-pool-your',
        name: 'Revs Watch Party',
        inviteCode: 'MOCKNE',
        eventName: 'MLS',
        scoringStyle: 'classic',
        members: 12,
        memberId: 'mock-member-your',
        isYours: true,
        yourRank: 3,
        yourPoints: 41,
      },
      {
        id: 'mock-pool-office',
        name: 'Office MLS Bracket',
        inviteCode: 'MOCKOF',
        eventName: 'MLS',
        scoringStyle: 'classic',
        members: 28,
        memberId: 'mock-member-office',
        isYours: true,
        yourRank: 7,
        yourPoints: 33,
      },
      {
        id: 'mock-pool-public',
        name: 'PoolCup MLS Official',
        inviteCode: 'MOCKML',
        eventName: 'MLS',
        scoringStyle: 'classic',
        members: 1840,
        memberId: '',
        isYours: false,
        yourRank: null,
        yourPoints: null,
      },
    ],
    team1Form: mockForm(['W', 'W', 'L', 'W', 'D']),
    team2Form: mockForm(['D', 'L', 'W', 'W', 'L']),
    headToHead: {
      team1Wins: 3,
      draws: 2,
      team2Wins: 2,
      meetings: [
        {
          kickoffAt: '2025-07-12T23:30:00.000Z',
          team1Name: home,
          team2Name: away,
          resultTeam1: 2,
          resultTeam2: 1,
          winnerLabel: home,
        },
        {
          kickoffAt: '2024-09-18T23:30:00.000Z',
          team1Name: away,
          team2Name: home,
          resultTeam1: 1,
          resultTeam2: 1,
          winnerLabel: 'Draw',
        },
        {
          kickoffAt: '2024-04-06T23:30:00.000Z',
          team1Name: home,
          team2Name: away,
          resultTeam1: 0,
          resultTeam2: 2,
          winnerLabel: away,
        },
        {
          kickoffAt: '2023-08-20T23:30:00.000Z',
          team1Name: home,
          team2Name: away,
          resultTeam1: 3,
          resultTeam2: 1,
          winnerLabel: home,
        },
        {
          kickoffAt: '2023-03-11T23:30:00.000Z',
          team1Name: away,
          team2Name: home,
          resultTeam1: 0,
          resultTeam2: 1,
          winnerLabel: home,
        },
      ],
    },
  }
}
