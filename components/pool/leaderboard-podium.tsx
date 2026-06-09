'use client'

import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'

type PodiumPlace = 1 | 2 | 3

type PodiumSlotConfig = {
  place: PodiumPlace
  accent: string
  accentDark: string
  pedestalClass: string
}

const PODIUM_LAYOUT: PodiumSlotConfig[] = [
  {
    place: 2,
    accent: '#c0c0c0',
    accentDark: '#7a7a7a',
    pedestalClass: 'h-16 sm:h-20',
  },
  {
    place: 1,
    accent: '#ffb300',
    accentDark: '#b87a00',
    pedestalClass: 'h-24 sm:h-28',
  },
  {
    place: 3,
    accent: '#cd7f32',
    accentDark: '#8b5420',
    pedestalClass: 'h-12 sm:h-14',
  },
]

function getPodiumMembers(
  members: LeaderboardMember[],
): (LeaderboardMember | null)[] {
  return [members[1] ?? null, members[0] ?? null, members[2] ?? null]
}

function podiumGradient(accent: string, accentDark: string, isEmpty: boolean) {
  if (isEmpty) {
    return `linear-gradient(to bottom, ${accent}33, ${accentDark}22)`
  }
  return `linear-gradient(to bottom, ${accent}, ${accentDark})`
}

function PodiumSlot({
  member,
  config,
  hasResults,
}: {
  member: LeaderboardMember | null
  config: PodiumSlotConfig
  hasResults: boolean
}) {
  const isEmpty = member == null
  const showPoints = !isEmpty || hasResults

  return (
    <div className="flex w-full min-w-0 flex-col items-center">
      <div className="flex w-full max-w-[108px] flex-col items-center sm:max-w-[120px]">
        <div className="flex flex-col items-center">
          {config.place === 1 && (
            <Crown
              className={cn(
                'mb-0.5 h-4 w-4 shrink-0',
                isEmpty ? 'text-muted-foreground/25' : 'text-[#ffb300]',
              )}
              aria-hidden
            />
          )}

          <div
            className="mb-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            style={{
              backgroundColor: isEmpty ? undefined : `${config.accent}22`,
              color: isEmpty ? undefined : config.accent,
              border: isEmpty
                ? '1px dashed hsl(var(--muted-foreground) / 0.35)'
                : `1px solid ${config.accent}66`,
            }}
          >
            {config.place}
          </div>

          <div
            className={cn(
              'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
              isEmpty
                ? 'border-2 border-dashed border-muted-foreground/30 bg-transparent text-transparent'
                : member.isYou
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
            )}
            style={
              isEmpty
                ? undefined
                : {
                    boxShadow: `0 0 0 2px var(--background), 0 0 0 4px ${config.accent}`,
                  }
            }
          >
            {!isEmpty && member.avatar}
          </div>

          {!isEmpty ? (
            <div className="mt-1 flex max-w-full items-center justify-center gap-1">
              <span
                className={cn(
                  'truncate text-center text-xs font-medium',
                  member.isYou ? 'text-primary' : 'text-foreground',
                )}
              >
                {member.name}
              </span>
              {member.isYou && (
                <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-px text-[9px] font-medium text-primary">
                  you
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 h-4" aria-hidden />
          )}

          {showPoints && (
            <>
              <div
                className={cn(
                  'font-display text-lg leading-none',
                  isEmpty ? 'mt-0.5 text-muted-foreground/35' : 'mt-0.5',
                )}
                style={isEmpty ? undefined : { color: config.accent }}
              >
                {isEmpty ? '0' : member.points}
              </div>
              <p className="text-[9px] leading-none text-muted-foreground">pts</p>
            </>
          )}
        </div>

        <div
          className={cn('w-full shrink-0 rounded-t-md', config.pedestalClass)}
          style={{
            background: podiumGradient(config.accent, config.accentDark, isEmpty),
          }}
          aria-hidden
        />
      </div>
    </div>
  )
}

export function LeaderboardPodium({
  members,
  hasResults,
}: {
  members: LeaderboardMember[]
  hasResults: boolean
}) {
  const slots = hasResults
    ? getPodiumMembers(members)
    : ([null, null, null] as const)

  return (
    <div
      className="grid grid-cols-3 items-end gap-1 px-2 pb-0 pt-2 sm:gap-2 sm:px-3"
      aria-label="Top 3 leaderboard"
    >
      {PODIUM_LAYOUT.map((config, index) => (
        <PodiumSlot
          key={config.place}
          member={slots[index] ?? null}
          config={config}
          hasResults={hasResults}
        />
      ))}
    </div>
  )
}
