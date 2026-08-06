'use client'

import { ArrowLeft, MoreVertical } from 'lucide-react'
import {
  DashboardGlassBackdrops,
  dashboardGlassSurfaceClass,
} from '@/components/dashboard/dashboard-glass-surface'
import { ChatSystemMoment } from '@/components/pool/chat-system-moment'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { cn } from '@/lib/utils'
import type { PoolChatMessage } from '@/src/lib/pool-chat-helpers'

/**
 * Landing-only presentational pool-chat slice for section 05.
 * Static example data — no auth, fetch, realtime, or send.
 */

type MockReaction = { emoji: string; count: number }

type MockUserMessage = {
  id: string
  kind: 'user'
  name: string
  avatar?: string | null
  avatarSrc?: string | null
  content: string
  /** Right-aligned “you” (Pucky in this landing mock). */
  isYou?: boolean
  reactions?: MockReaction[]
}

type MockSystemMessage = {
  id: string
  kind: 'system'
  message: PoolChatMessage
}

type MockFeedItem = MockUserMessage | MockSystemMessage

const FIXED_AT = '2026-08-06T18:42:00.000Z'

/**
 * Climactic beat — fully visible, no scroll.
 * Distinct avatar assets per person; Pucky = right-aligned sender.
 */
const FEED: MockFeedItem[] = [
  {
    id: '1',
    kind: 'user',
    name: 'Jordan',
    avatar: 'goal_keeper_red.png',
    content: "He's driving... he's going up...",
  },
  {
    id: '2',
    kind: 'user',
    name: 'Alex',
    avatar: 'brown_skin_avatar.png',
    content: 'NO WAY HE MISSED THAT!',
  },
  {
    id: '3',
    kind: 'user',
    name: 'Sam',
    avatar: 'cheerleader.png',
    content: 'YES! IT MISSED! WE WON!',
    reactions: [
      { emoji: '🔥', count: 4 },
      { emoji: '😂', count: 2 },
    ],
  },
  {
    id: '4',
    kind: 'user',
    name: 'Jordan',
    avatar: 'goal_keeper_red.png',
    content: "Let's goooo! What an ending!",
    reactions: [{ emoji: '⚽', count: 3 }],
  },
  {
    id: 'lead',
    kind: 'system',
    message: {
      id: 'landing-lead',
      pool_id: '',
      user_id: null,
      content: '👑 Alex is leading the pool right now',
      created_at: FIXED_AT,
      message_type: 'system',
      metadata: { kind: 'new_leader', player: 'Alex' },
    },
  },
  {
    id: 'pucky',
    kind: 'user',
    name: 'Pucky',
    avatarSrc: '/mascot/pucky_trophy.png',
    isYou: true,
    content: '🐧 Absolute cinema.',
  },
]

/** Compact live scoreboard chrome — no kickoff date; static LIVE + minute. */
function LandingLiveScoreboard() {
  return (
    <div
      className={cn(
        dashboardGlassSurfaceClass('xl', 'compact'),
        'px-3 py-2.5 sm:px-4 sm:py-3',
      )}
    >
      <DashboardGlassBackdrops variant="compact" />
      <div className="relative flex items-center gap-2 sm:gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamFlagImage
            countryName="Spain"
            imgClassName="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8"
            emojiClassName="text-lg sm:text-xl"
          />
          <span className="truncate text-xs font-semibold leading-tight text-foreground sm:text-sm">
            Spain
          </span>
        </div>

        <p className="shrink-0 font-display text-lg leading-none tracking-wide text-foreground tabular-nums sm:text-xl">
          <span className="text-primary">2</span>
          <span className="mx-0.5 text-muted-foreground/80">–</span>
          <span className="text-primary">1</span>
        </p>

        <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2">
          <TeamFlagImage
            countryName="Belgium"
            imgClassName="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8"
            emojiClassName="text-lg sm:text-xl"
          />
          <span className="truncate text-xs font-semibold leading-tight text-foreground sm:text-sm">
            Belgium
          </span>
        </div>

        <div className="ml-0.5 shrink-0 border-l border-white/10 pl-2.5 sm:pl-3">
          <div className="flex flex-col items-center gap-0.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
              <span
                className="stage-live-dot h-1.5 w-1.5 shrink-0 rounded-full"
                aria-hidden
              />
              Live
            </span>
            <span className="text-[11px] font-medium tabular-nums leading-none text-primary sm:text-xs">
              87&apos;
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StaticReactionChip({ emoji, count }: MockReaction) {
  return (
    <span
      className="inline-flex min-h-7 items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 text-xs text-foreground"
      aria-hidden
    >
      <span>{emoji}</span>
      <span className="font-mono tabular-nums">{count}</span>
    </span>
  )
}

function MockAvatar({ item }: { item: MockUserMessage }) {
  if (item.avatarSrc) {
    return (
      <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-border bg-[#0b1711] sm:h-8 sm:w-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- static landing asset */}
        <img
          src={item.avatarSrc}
          alt=""
          className="h-[92%] w-[92%] object-contain object-[center_42%]"
        />
      </div>
    )
  }

  return (
    <UserAvatarImage
      avatar={item.avatar ?? null}
      customAvatarUrl={null}
      className="h-7 w-7 sm:h-8 sm:w-8"
    />
  )
}

function MockUserBubble({
  item,
  showIdentity,
}: {
  item: MockUserMessage
  showIdentity: boolean
}) {
  const isYou = Boolean(item.isYou)
  // Avatar gutter — keep bubble column lined up when identity is hidden (stacked).
  const gutterClass = 'w-7 shrink-0 sm:w-8'
  const reactionIndent = isYou
    ? 'mr-[calc(1.75rem+0.5rem)] sm:mr-[calc(2rem+0.5rem)]'
    : 'ml-[calc(1.75rem+0.5rem)] sm:ml-[calc(2rem+0.5rem)]'

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col',
        isYou ? 'items-end' : 'items-start',
      )}
    >
      {/* Avatar + name/bubble only — reactions sit outside so they don't shift alignment */}
      <div
        className={cn(
          'flex w-full min-w-0 items-end gap-2',
          isYou && 'flex-row-reverse',
        )}
      >
        <div className={gutterClass}>
          {showIdentity ? <MockAvatar item={item} /> : null}
        </div>

        <div
          className={cn(
            'flex min-w-0 max-w-[min(100%,16.5rem)] flex-col sm:max-w-[min(100%,18.5rem)]',
            isYou ? 'items-end' : 'items-start',
          )}
        >
          {showIdentity ? (
            <span
              className={cn(
                'mb-0.5 text-[11px] font-semibold sm:text-xs',
                isYou ? 'text-primary' : 'text-foreground',
              )}
            >
              {isYou ? 'You' : item.name}
            </span>
          ) : null}

          <div
            className={cn(
              'rounded-2xl px-2.5 py-1.5 text-[12px] leading-snug break-words whitespace-pre-wrap text-foreground sm:px-3 sm:py-2 sm:text-[13px]',
              isYou
                ? 'rounded-tr-md bg-primary/20 ring-1 ring-primary/35'
                : 'rounded-tl-md bg-muted/60',
            )}
          >
            {item.content}
          </div>
        </div>
      </div>

      {item.reactions && item.reactions.length > 0 ? (
        <div
          className={cn(
            'mt-1 flex flex-wrap gap-1',
            reactionIndent,
            isYou ? 'justify-end' : 'justify-start',
          )}
        >
          {item.reactions.map((reaction) => (
            <StaticReactionChip
              key={`${item.id}-${reaction.emoji}`}
              emoji={reaction.emoji}
              count={reaction.count}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

type LandingChatPreviewProps = {
  embedded?: boolean
}

export function LandingChatPreview({
  embedded = false,
}: LandingChatPreviewProps) {
  return (
    <div
      className={cn(
        'overflow-hidden',
        !embedded &&
          'rounded-2xl border border-[rgba(255,255,255,0.08)] shadow-[0_16px_40px_rgba(0,0,0,0.35)]',
      )}
      aria-hidden
    >
      <div className="mx-auto w-full max-w-md bg-[#131313]">
        {/* Header — title left, settings kebab right (top-bar / --background blackish) */}
        <div className="border-b border-white/[0.08] bg-[#131313] px-3 py-2.5 sm:px-3.5 sm:py-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </div>
            <h2 className="min-w-0 flex-1 truncate font-display text-xl tracking-wide text-foreground sm:text-2xl">
              Office Team WC 2026
            </h2>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
              aria-label="Chat settings"
            >
              <MoreVertical className="h-4 w-4" aria-hidden />
            </div>
          </div>
        </div>

        {/* Live scoreboard — keeps its own glass background */}
        <div className="border-b border-white/[0.08] bg-[#131313] px-2.5 py-2 sm:px-3">
          <LandingLiveScoreboard />
        </div>

        {/* Thread — same blackish as header / top bar */}
        <div className="flex flex-col bg-[#131313]">
          <div className="h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary" />
          <div className="space-y-1.5 px-2.5 py-2.5 sm:space-y-2 sm:px-3 sm:py-3">
            {FEED.map((item, index) => {
              if (item.kind === 'system') {
                return (
                  <ChatSystemMoment key={item.id} message={item.message} />
                )
              }

              const previous = FEED[index - 1]
              const showIdentity =
                previous?.kind !== 'user' || previous.name !== item.name

              return (
                <MockUserBubble
                  key={item.id}
                  item={item}
                  showIdentity={showIdentity}
                />
              )
            })}
          </div>

          <div className="flex items-center gap-2 border-t border-white/[0.08] bg-[#131313] px-2.5 py-2 sm:px-3">
            <div className="min-h-8 min-w-0 flex-1 rounded-md border border-border/70 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground/70">
              Message your pool…
            </div>
            <div className="inline-flex h-8 shrink-0 items-center rounded-md bg-primary/25 px-3 text-xs font-semibold text-primary">
              Send
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
