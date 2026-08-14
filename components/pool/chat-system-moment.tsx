'use client'

import { TeamFlagImage } from '@/components/predict/team-flag-image'
import {
  formatChatTimestamp,
  formatPlayerList,
  type PoolChatMessage,
  type PoolChatSystemMetadata,
} from '@/src/lib/pool-chat-helpers'

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function asScore(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return '—'
}

function asPlayerList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
}

function FullTimeMoment({
  meta,
  fallback,
}: {
  meta: PoolChatSystemMetadata
  fallback: string
}) {
  const team1 = asString(meta.team1) ?? 'Team 1'
  const team2 = asString(meta.team2) ?? 'Team 2'
  const score1 = asScore(meta.score1)
  const score2 = asScore(meta.score2)
  const logo1 = asString(meta.team1_logo)
  const logo2 = asString(meta.team2_logo)

  return (
    <div className="hue-card-surface overflow-hidden rounded-2xl border border-primary/35 bg-gradient-to-br from-[#08140f] via-[#0c1712] to-primary/[0.12] shadow-[0_10px_28px_rgba(0,0,0,0.35),0_0_24px_color-mix(in_srgb,var(--primary)_12%,transparent)]">
      <div className="flex items-center justify-between border-b border-primary/20 bg-primary/10 px-3 py-1.5">
        <span className="font-display text-[11px] tracking-[0.14em] text-primary">
          FULL TIME
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
          Match result
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3">
        <div className="flex min-w-0 flex-col items-center gap-1.5">
          <TeamFlagImage
            countryName={team1}
            logoUrl={logo1}
            imgClassName="h-9 w-9 object-contain"
            emojiClassName="text-2xl leading-none"
          />
          <p className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-foreground">
            {team1}
          </p>
        </div>
        <div className="flex flex-col items-center px-1">
          <p className="font-display text-2xl leading-none tabular-nums tracking-wide text-foreground">
            {score1}
            <span className="mx-1 text-muted-foreground">–</span>
            {score2}
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1.5">
          <TeamFlagImage
            countryName={team2}
            logoUrl={logo2}
            imgClassName="h-9 w-9 object-contain"
            emojiClassName="text-2xl leading-none"
          />
          <p className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-foreground">
            {team2}
          </p>
        </div>
      </div>
      {fallback ? (
        <p className="border-t border-border/50 px-3 py-1.5 text-center text-[10px] text-muted-foreground">
          {fallback}
        </p>
      ) : null}
    </div>
  )
}

/** Discord-style muted centered system notice — not a card. */
function SystemTextLine({ text }: { text: string }) {
  return (
    <p className="mx-auto max-w-md px-3 py-1 text-center text-[11px] leading-snug text-muted-foreground">
      {text}
    </p>
  )
}

function exactScoreLine(
  meta: PoolChatSystemMetadata,
  fallback: string,
): string {
  if (fallback) return fallback
  const names = formatPlayerList(asPlayerList(meta.players))
  const score1 = asString(meta.score1)
  const score2 = asString(meta.score2)
  const scoreLine =
    score1 != null && score2 != null ? ` ${score1}-${score2}` : ''
  return `🎯 Exact score! ${names} nailed${scoreLine}`
}

function newLeaderLine(
  meta: PoolChatSystemMetadata,
  fallback: string,
): string {
  if (fallback) return fallback
  const player = asString(meta.player) ?? 'Someone'
  return `👑 ${player} is now leading the pool!`
}

export function ChatSystemMoment({ message }: { message: PoolChatMessage }) {
  const meta = (message.metadata ?? {}) as PoolChatSystemMetadata
  const kind = asString(meta.kind) ?? ''
  const fallback = message.content?.trim() ?? ''

  if (kind === 'full_time') {
    return (
      <div className="mx-auto w-full max-w-sm px-1 py-1">
        <FullTimeMoment meta={meta} fallback={fallback} />
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/80">
          <time dateTime={message.created_at} suppressHydrationWarning>
            {formatChatTimestamp(message.created_at)}
          </time>
        </p>
      </div>
    )
  }

  const text =
    kind === 'exact_score'
      ? exactScoreLine(meta, fallback)
      : kind === 'new_leader'
        ? newLeaderLine(meta, fallback)
        : fallback || 'Match update'

  return <SystemTextLine text={text} />
}
