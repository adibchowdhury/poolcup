import type { DiscordChannelKey } from '@/src/lib/discord-pucky'

/** US / multisport channels — soccer formatters live in discord-soccer-events.ts */
export type DiscordUsSportKey = Exclude<DiscordChannelKey, 'soccer'>

export const DISCORD_US_SPORT_KEYS: DiscordUsSportKey[] = [
  'football',
  'basketball',
  'baseball',
  'hockey',
]

export type MatchDiscordMessageContext = {
  team1Name: string
  team2Name: string
  eventName?: string | null
}

type SportMessageStyle = {
  emoji: string
  /** Reminder: "{emoji} {teams} {term} <t:…:R> …" */
  reminderStartTerm: string
  /** Live start line after "LIVE — {teams} " */
  liveStartPhrase: string
  scoreTerm: string
  finalLabel: string
}

const US_SPORT_STYLES: Record<DiscordUsSportKey, SportMessageStyle> = {
  football: {
    emoji: '🏈',
    reminderStartTerm: 'Kickoff',
    liveStartPhrase: 'Kickoff! Picks are locked — good luck everyone 🍀',
    scoreTerm: 'TOUCHDOWN!',
    finalLabel: 'FINAL',
  },
  basketball: {
    emoji: '🏀',
    reminderStartTerm: 'Tip-off',
    liveStartPhrase: 'Tip-off! Picks are locked — good luck everyone 🍀',
    scoreTerm: 'BUCKET!',
    finalLabel: 'FINAL',
  },
  baseball: {
    emoji: '⚾',
    reminderStartTerm: 'First pitch',
    liveStartPhrase: 'First pitch! Picks are locked — good luck everyone 🍀',
    scoreTerm: 'RUN!',
    finalLabel: 'FINAL',
  },
  hockey: {
    emoji: '🏒',
    reminderStartTerm: 'Puck drop',
    liveStartPhrase: 'Puck drop! Picks are locked — good luck everyone 🍀',
    scoreTerm: 'GOAL!',
    finalLabel: 'FINAL',
  },
}

function withCompetitionPrefix(
  content: string,
  eventName?: string | null,
): string {
  const label = eventName?.trim()
  if (!label) return content
  return `[${label}] ${content}`
}

function styleFor(sport: DiscordUsSportKey): SportMessageStyle {
  return US_SPORT_STYLES[sport]
}

export function formatSportReminderMessage(
  sport: DiscordUsSportKey,
  ctx: MatchDiscordMessageContext,
  startAtIso: string,
): string {
  const { emoji, reminderStartTerm } = styleFor(sport)
  const unix = Math.floor(new Date(startAtIso).getTime() / 1000)
  if (!Number.isFinite(unix)) {
    throw new Error('Invalid start timestamp for reminder message')
  }
  const termLower = reminderStartTerm.toLowerCase()
  return withCompetitionPrefix(
    `⏰ ${emoji} ${ctx.team1Name} vs ${ctx.team2Name} ${reminderStartTerm} <t:${unix}:R> — get your picks in before ${termLower}!`,
    ctx.eventName,
  )
}

export function formatSportStartMessage(
  sport: DiscordUsSportKey,
  ctx: MatchDiscordMessageContext,
): string {
  const { emoji, liveStartPhrase } = styleFor(sport)
  return withCompetitionPrefix(
    `${emoji} LIVE — ${ctx.team1Name} vs ${ctx.team2Name} ${liveStartPhrase}`,
    ctx.eventName,
  )
}

export function formatSportScoreMessage(
  sport: DiscordUsSportKey,
  ctx: MatchDiscordMessageContext,
  afterScores: { t1: number; t2: number },
  periodLabel?: string | null,
): string {
  const { emoji, scoreTerm } = styleFor(sport)
  const periodSuffix = periodLabel?.trim() ? ` (${periodLabel})` : ''
  return withCompetitionPrefix(
    `${emoji} ${scoreTerm} ${ctx.team1Name} ${afterScores.t1}-${afterScores.t2} ${ctx.team2Name}${periodSuffix}`,
    ctx.eventName,
  )
}

export function formatSportFinalMessage(
  sport: DiscordUsSportKey,
  ctx: MatchDiscordMessageContext,
  resultTeam1: number,
  resultTeam2: number,
): string {
  const { emoji, finalLabel } = styleFor(sport)
  return withCompetitionPrefix(
    `${emoji} ${finalLabel} — ${ctx.team1Name} ${resultTeam1}-${resultTeam2} ${ctx.team2Name}`,
    ctx.eventName,
  )
}

/** Preview sample fixtures per US sport (reused by preview route; hooks use live data). */
export const US_SPORT_PREVIEW_FIXTURES: Record<
  DiscordUsSportKey,
  {
    ctx: MatchDiscordMessageContext
    previewScores: { live: { t1: number; t2: number }; final: { t1: number; t2: number } }
    periodLabel: string
  }
> = {
  football: {
    ctx: {
      team1Name: 'Cowboys',
      team2Name: 'Eagles',
      eventName: 'NFL',
    },
    previewScores: { live: { t1: 7, t2: 0 }, final: { t1: 24, t2: 21 } },
    periodLabel: 'Q2 5:00',
  },
  basketball: {
    ctx: {
      team1Name: 'Lakers',
      team2Name: 'Celtics',
      eventName: 'NBA',
    },
    previewScores: { live: { t1: 52, t2: 48 }, final: { t1: 108, t2: 102 } },
    periodLabel: 'Q2 5:32',
  },
  baseball: {
    ctx: {
      team1Name: 'Yankees',
      team2Name: 'Dodgers',
      eventName: 'MLB',
    },
    previewScores: { live: { t1: 1, t2: 0 }, final: { t1: 4, t2: 3 } },
    periodLabel: 'Top 3rd',
  },
  hockey: {
    ctx: {
      team1Name: 'Rangers',
      team2Name: 'Bruins',
      eventName: 'NHL',
    },
    previewScores: { live: { t1: 1, t2: 0 }, final: { t1: 3, t2: 2 } },
    periodLabel: 'P1 12:34',
  },
}

export function buildUsSportPreviewMessages(
  sport: DiscordUsSportKey,
  startAtIso: string,
): Array<{ type: 'reminder' | 'start' | 'score' | 'final'; content: string }> {
  const fixture = US_SPORT_PREVIEW_FIXTURES[sport]
  const { ctx, previewScores, periodLabel } = fixture

  return [
    {
      type: 'reminder',
      content: formatSportReminderMessage(sport, ctx, startAtIso),
    },
    {
      type: 'start',
      content: formatSportStartMessage(sport, ctx),
    },
    {
      type: 'score',
      content: formatSportScoreMessage(
        sport,
        ctx,
        previewScores.live,
        periodLabel,
      ),
    },
    {
      type: 'final',
      content: formatSportFinalMessage(
        sport,
        ctx,
        previewScores.final.t1,
        previewScores.final.t2,
      ),
    },
  ]
}
