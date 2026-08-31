'use client'

import Image from 'next/image'
import { type ReactNode } from 'react'
import { Check, Copy, Crown, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  LeaderboardLastPick,
  LeaderboardMember,
} from '@/components/pool/leaderboard-row'
import {
  buildLeaderboardPlaceGroups,
  ordinalPlace,
} from '@/components/pool/leaderboard-grouped-list'
import { Button } from '@/components/ui/button'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { LoginPanelConfetti, LEADERBOARD_PODIUM_CONFETTI_X_RANGE } from '@/components/auth/login-panel-confetti'
import { TeamFlagImage } from '@/components/predict/team-flag-image'
import { POOL_LEADERBOARD_DESKTOP_CONTENT_RAIL_CLASS } from '@/components/pool/pool-desktop-top-bar'
import { POOL_DESKTOP_CANVAS_CLASS } from '@/src/lib/dashboard-surfaces'

const CLIMB_STREAK_FIRE_MIN = 3

const ACCENT_GREEN = 'var(--primary)'
const RING_SILVER = '#c0c6d0'
const RING_BRONZE = '#c47a3d'

/**
 * Desktop table column template —
 * Rank · Member · Points · Trend · Last Pick
 * gap-x-6 for breathing room between Points / Trend / Last Pick.
 */
const DESKTOP_TABLE_COLS =
  'lg:grid lg:grid-cols-[3.5rem_minmax(0,1.5fr)_5.5rem_5.75rem_minmax(9.5rem,1.15fr)] lg:items-center lg:gap-x-6'

const LAST_PICK_FLAG_IMG =
  'h-[17px] w-[17px] shrink-0 rounded-[2px] object-cover'

function LastPickCrest({
  name,
  logoUrl,
  flag,
}: {
  name: string
  logoUrl: string | null
  flag: string | null
}) {
  return (
    <TeamFlagImage
      countryName={name}
      dbFlag={flag}
      logoUrl={logoUrl}
      imgClassName={LAST_PICK_FLAG_IMG}
      emojiClassName="text-[11px] leading-none"
    />
  )
}

function LastPickScoreline({
  team1Name,
  team2Name,
  predTeam1,
  predTeam2,
  team1Logo = null,
  team2Logo = null,
  team1Flag = null,
  team2Flag = null,
}: {
  team1Name: string
  team2Name: string
  predTeam1: number
  predTeam2: number
  team1Logo?: string | null
  team2Logo?: string | null
  team1Flag?: string | null
  team2Flag?: string | null
}) {
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1.5"
      title={`${team1Name} ${predTeam1}–${predTeam2} ${team2Name}`}
    >
      <LastPickCrest name={team1Name} logoUrl={team1Logo} flag={team1Flag} />
      <span className="font-mono text-xs tabular-nums text-foreground/90">
        {predTeam1}–{predTeam2}
      </span>
      <LastPickCrest name={team2Name} logoUrl={team2Logo} flag={team2Flag} />
    </span>
  )
}

function LastPickCell({ pick }: { pick: LeaderboardLastPick | null | undefined }) {
  if (!pick) {
    return (
      <span className="text-sm text-muted-foreground/60" aria-label="No predictions">
        —
      </span>
    )
  }
  return (
    <LastPickScoreline
      team1Name={pick.team1Name}
      team2Name={pick.team2Name}
      predTeam1={pick.predTeam1}
      predTeam2={pick.predTeam2}
      team1Logo={pick.team1Logo}
      team2Logo={pick.team2Logo}
      team1Flag={pick.team1Flag}
      team2Flag={pick.team2Flag}
    />
  )
}

type OrderedStanding = {
  place: number
  member: LeaderboardMember
}

function flattenStandings(members: LeaderboardMember[]): OrderedStanding[] {
  return buildLeaderboardPlaceGroups(members).flatMap((group) =>
    group.members.map((member) => ({ place: group.place, member })),
  )
}

function RankMovementBadge({
  movement,
  rankDelta,
  className,
}: {
  movement: LeaderboardMember['movement']
  rankDelta: number
  className?: string
}) {
  if (movement === 'none' || rankDelta <= 0) {
    return null
  }

  if (movement === 'up') {
    return (
      <span
        className={cn(
          'inline-flex min-w-[1.75rem] items-center justify-center gap-0.5 font-mono text-xs font-semibold',
          className,
        )}
        style={{ color: ACCENT_GREEN }}
        aria-label={`Up ${rankDelta} ${rankDelta === 1 ? 'place' : 'places'}`}
      >
        <span aria-hidden>▲</span>
        {rankDelta}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-[1.75rem] items-center justify-center gap-0.5 font-mono text-xs font-semibold text-red-500',
        className,
      )}
      aria-label={`Down ${rankDelta} ${rankDelta === 1 ? 'place' : 'places'}`}
    >
      <span aria-hidden>▼</span>
      {rankDelta}
    </span>
  )
}

/** Fire streak — list rows only (not podium). */
function ClimbFireBadge({ climbStreak }: { climbStreak: number }) {
  if (climbStreak < CLIMB_STREAK_FIRE_MIN) return null
  return (
    <span
      className="inline-flex shrink-0 items-center"
      title={`Climbing — ${climbStreak} consecutive rises`}
      aria-label={`Climb streak ${climbStreak}`}
    >
      <Image
        src="/fire_streak.png"
        alt=""
        width={18}
        height={18}
        className="object-contain"
        aria-hidden
      />
    </span>
  )
}

function MemberIdentity({
  userId,
  disableLinks,
  className,
  ariaLabel,
  children,
}: {
  userId: string
  disableLinks?: boolean
  className?: string
  ariaLabel?: string
  children: ReactNode
}) {
  if (disableLinks) {
    return (
      <span className={className} aria-label={ariaLabel}>
        {children}
      </span>
    )
  }

  return (
    <UserProfileLink
      userId={userId}
      className={className}
      ariaLabel={ariaLabel}
    >
      {children}
    </UserProfileLink>
  )
}

function PodiumPedestal({
  place,
  member,
  disableProfileLinks,
  firstPlaceFigureSrc,
  omitCrownSpacer = false,
  compact = false,
}: {
  place: 1 | 2 | 3
  member: LeaderboardMember
  disableProfileLinks?: boolean
  /** Landing-only: show a free-standing mascot figure instead of the 1st avatar ring. */
  firstPlaceFigureSrc?: string
  /** Landing mascot podium: drop 2nd/3rd crown-alignment spacer so winners sit higher. */
  omitCrownSpacer?: boolean
  /** Login / tight preview — same DNA, smaller chrome. */
  compact?: boolean
}) {
  const isFirst = place === 1
  const useMascotFigure = isFirst && Boolean(firstPlaceFigureSrc)
  const avatarSize = compact
    ? isFirst
      ? 'h-16 w-16'
      : 'h-14 w-14'
    : isFirst
      ? 'h-[5.5rem] w-[5.5rem] sm:h-24 sm:w-24'
      : 'h-[4.25rem] w-[4.25rem] sm:h-[4.75rem] sm:w-[4.75rem]'

  // Classic tier heights — 1st tallest, 2nd medium, 3rd shortest.
  // Landing Pucky podium: extra-tall 1st pedestal for more elevation.
  // Compact (login): ~1.37× homepage base (4.75/3.25/2.25) → taller substantial pillars.
  const pedestalH = compact
    ? place === 1
      ? 'h-[6.5rem]'
      : place === 2
        ? 'h-[4.5rem]'
        : 'h-[3.25rem]'
    : place === 1
      ? useMascotFigure
        ? 'h-[6.75rem] sm:h-[8.25rem]'
        : 'h-[4.75rem] sm:h-[5.75rem]'
      : place === 2
        ? 'h-[3.25rem] sm:h-[4rem]'
        : 'h-[2.25rem] sm:h-[2.75rem]'

  const placeLabel = place === 1 ? '1ST' : place === 2 ? '2ND' : '3RD'

  // Avatar rings: 1st green (+ glow), 2nd silver, 3rd bronze.
  const ringColor =
    place === 1 ? ACCENT_GREEN : place === 2 ? RING_SILVER : place === 3 ? RING_BRONZE : ACCENT_GREEN
  const ringShadow = compact
    ? place === 1
      ? `0 0 12px color-mix(in srgb, var(--primary) 55%, transparent)`
      : place === 2
        ? `0 0 8px rgba(192,198,208,0.28)`
        : `0 0 8px rgba(196,122,61,0.28)`
    : place === 1
      ? `0 0 22px color-mix(in srgb, var(--primary) 65%, transparent), 0 0 6px color-mix(in srgb, var(--primary) 90%, transparent)`
      : place === 2
        ? `0 0 10px rgba(192,198,208,0.3)`
        : `0 0 10px rgba(196,122,61,0.3)`

  // Compact login pillars: muted premium metallics (not bright/cartoony).
  const pedestalMetal =
    place === 1
      ? {
          fill: 'linear-gradient(180deg, #a3822f 0%, #8a6d2a 42%, #6e5620 100%)',
          edge: '#F2C94C',
          label: 'text-[#f7f0d8]',
        }
      : place === 2
        ? {
            fill: 'linear-gradient(180deg, #9aa2ad 0%, #7e868f 45%, #636a73 100%)',
            edge: '#d0d5dc',
            label: 'text-[#f0f2f5]',
          }
        : {
            fill: 'linear-gradient(180deg, #a06b42 0%, #8a5a34 45%, #6f4829 100%)',
            edge: '#d4a574',
            label: 'text-[#f5ebe0]',
          }

  return (
    <div
      className={cn(
        'flex flex-col items-center',
        compact ? 'px-0.5' : 'px-1 sm:px-1.5',
        isFirst
          ? useMascotFigure
            ? 'order-2 w-[42%] max-w-[14rem] sm:max-w-[16rem]'
            : compact
              ? 'order-2 w-[36%] max-w-[9rem]'
              : 'order-2 w-[36%] max-w-[10.5rem] sm:max-w-[12rem]'
          : null,
        place === 2
          ? compact
            ? 'order-1 w-[32%] max-w-[7.75rem]'
            : 'order-1 w-[32%] max-w-[9.5rem] sm:max-w-[10.5rem]'
          : null,
        place === 3
          ? compact
            ? 'order-3 w-[32%] max-w-[7.75rem]'
            : 'order-3 w-[32%] max-w-[9.5rem] sm:max-w-[10.5rem]'
          : null,
      )}
    >
      {useMascotFigure ? (
        <>
          {/*
            No fixed-height box — a tall clamp + object-contain/object-bottom
            was letterboxing empty space above Pucky at the top of the card.
            Size via max-height so the figure is still large but hugs content.
          */}
          <div
            className="relative flex w-[min(100%,11.5rem)] justify-center sm:w-[min(100%,13.5rem)]"
            aria-hidden
          >
            <Image
              src={firstPlaceFigureSrc!}
              alt=""
              width={240}
              height={240}
              className="h-auto w-full max-h-[10.5rem] object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.5)] sm:max-h-[12rem]"
              priority={false}
            />
          </div>

          <div className="mb-1 mt-0.5 w-full px-0.5 text-center sm:mb-1.5">
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0">
              <MemberIdentity
                userId={member.userId}
                disableLinks={disableProfileLinks}
                className={cn(
                  'max-w-full text-center text-[13px] font-semibold leading-tight break-words text-white sm:text-sm',
                  !disableProfileLinks && 'hover:underline',
                )}
              >
                {member.name}
              </MemberIdentity>
            </div>
            {member.isYou ? (
              <span className="mt-0.5 inline-block rounded-full bg-primary/20 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">
                You
              </span>
            ) : null}
            <p
              className="mt-0.5 font-mono text-xl tabular-nums leading-tight tracking-wide sm:text-2xl"
              style={{ color: ACCENT_GREEN }}
            >
              {member.points}
              <span className="ml-1 text-[11px] font-sans font-normal text-muted-foreground">
                pts
              </span>
            </p>
            {member.exactScores > 0 ? (
              <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                {member.exactScores} exact
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div
            className={cn(
              'relative flex w-full flex-col items-center',
              compact ? 'mb-1' : 'mb-2.5 sm:mb-3',
            )}
          >
            {isFirst ? (
              <Crown
                className={cn(
                  'text-[#ffb300] drop-shadow-[0_0_8px_rgba(255,179,0,0.55)]',
                  compact ? 'mb-0.5 h-5 w-5' : 'mb-1 h-6 w-6 sm:h-7 sm:w-7',
                )}
                aria-hidden
              />
            ) : omitCrownSpacer || compact ? null : (
              <div className="mb-1 h-6 sm:h-7" aria-hidden />
            )}
            <MemberIdentity
              userId={member.userId}
              disableLinks={disableProfileLinks}
              ariaLabel={`${member.name}'s profile`}
              className="relative shrink-0"
            >
              <div
                className={cn(
                  'rounded-full',
                  compact ? 'p-[1.5px]' : 'p-[2px]',
                  !disableProfileLinks &&
                    'transition-transform hover:scale-[1.03]',
                )}
                style={{
                  backgroundColor: ringColor,
                  boxShadow: ringShadow,
                }}
              >
                <UserAvatarImage
                  avatar={member.avatar}
                  customAvatarUrl={member.customAvatarUrl}
                  fallbackInitials={member.userId ? null : member.name}
                  fallbackColorKey={member.userId || member.name}
                  className={avatarSize}
                />
              </div>
            </MemberIdentity>
          </div>

          <div
            className={cn(
              'w-full px-0.5 text-center',
              compact ? 'mb-1' : 'mb-2.5 sm:mb-3',
            )}
          >
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
              <MemberIdentity
                userId={member.userId}
                disableLinks={disableProfileLinks}
                className={cn(
                  'max-w-full text-center font-semibold leading-snug break-words text-white',
                  compact ? 'text-xs' : 'text-[13px] sm:text-sm',
                  !disableProfileLinks && 'hover:underline',
                )}
              >
                {member.name}
              </MemberIdentity>
            </div>
            {member.isYou ? (
              <span
                className={cn(
                  'inline-block rounded-full bg-primary/20 font-semibold uppercase tracking-wide text-primary',
                  compact
                    ? 'mt-0.5 px-1.5 py-px text-[8px]'
                    : 'mt-1 px-2 py-px text-[10px]',
                )}
              >
                You
              </span>
            ) : null}
            <p
              className={cn(
                'font-mono tabular-nums tracking-wide',
                compact ? 'mt-0.5 text-base' : 'mt-1.5 text-xl sm:text-2xl',
              )}
              style={{ color: ACCENT_GREEN }}
            >
              {member.points}
              <span
                className={cn(
                  'ml-1 font-sans font-normal text-muted-foreground',
                  compact ? 'text-[9px]' : 'text-[11px]',
                )}
              >
                pts
              </span>
            </p>
            {!compact && member.exactScores > 0 ? (
              <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                {member.exactScores} exact
              </p>
            ) : null}
          </div>
        </>
      )}

      {/* Tiered podium base — compact login uses muted metallic fills. */}
      <div
        className={cn(
          'relative flex w-full flex-col items-center overflow-hidden rounded-t-md',
          pedestalH,
        )}
        style={
          compact
            ? {
                background: pedestalMetal.fill,
                boxShadow: `inset 0 1px 0 ${pedestalMetal.edge}`,
              }
            : {
                background:
                  'linear-gradient(180deg, #15201c 0%, #101616 45%, #0d1212 100%)',
                boxShadow:
                  'inset 0 1px 0 color-mix(in srgb, var(--primary) 35%, transparent)',
              }
        }
        aria-hidden
      >
        <div
          className="h-[2px] w-full shrink-0"
          style={{
            background: compact
              ? `linear-gradient(90deg, transparent 0%, ${pedestalMetal.edge} 18%, ${pedestalMetal.edge} 82%, transparent 100%)`
              : `linear-gradient(90deg, transparent 0%, ${ACCENT_GREEN} 20%, ${ACCENT_GREEN} 80%, transparent 100%)`,
            opacity: isFirst ? 0.95 : 0.75,
          }}
        />
        <span
          className={cn(
            'font-display tracking-[0.14em]',
            compact
              ? cn('mt-1.5 text-[10px]', pedestalMetal.label)
              : isFirst
                ? 'mt-2 text-[11px] text-white/90 sm:text-xs'
                : 'mt-2 text-[10px] text-white/90 sm:text-[11px]',
          )}
        >
          {placeLabel}
        </span>
      </div>
    </div>
  )
}

function StandingListRow({
  place,
  member,
  disableProfileLinks,
  compact = false,
}: {
  place: number
  member: LeaderboardMember
  disableProfileLinks?: boolean
  compact?: boolean
}) {
  const trend = (
    <div className="flex shrink-0 items-center gap-1">
      <RankMovementBadge
        movement={member.movement}
        rankDelta={member.rankDelta}
        className={compact ? 'min-w-[1.25rem] text-[10px]' : undefined}
      />
      <ClimbFireBadge climbStreak={member.climbStreak} />
    </div>
  )

  const pointsBlock = (
    <div
      className={cn(
        'shrink-0 text-right',
        compact ? 'w-12' : 'w-14 sm:w-16 lg:w-auto',
      )}
    >
      <span
        className={cn(
          'font-mono tabular-nums',
          compact ? 'text-sm' : 'text-lg sm:text-xl',
        )}
        style={{ color: ACCENT_GREEN }}
      >
        {member.points}
      </span>
      <span className="ml-0.5 text-[10px] text-muted-foreground lg:hidden">
        pts
      </span>
      {!compact && member.exactScores > 0 ? (
        <p className="text-[10px] tabular-nums text-muted-foreground lg:hidden">
          {member.exactScores} exact
        </p>
      ) : null}
    </div>
  )

  return (
    <li
      className={cn(
        'relative',
        compact
          ? 'flex items-center gap-2 px-2.5 py-1.5'
          : cn(
              'flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-3.5',
              DESKTOP_TABLE_COLS,
              'lg:min-h-14 lg:px-5 lg:py-0',
            ),
        member.isYou
          ? 'bg-[color-mix(in_srgb,var(--primary)_18%,var(--app-background))]'
          : !disableProfileLinks && 'hover:bg-white/[0.04]',
      )}
    >
      {member.isYou ? (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-r-sm lg:col-span-full lg:row-start-1"
          style={{ backgroundColor: ACCENT_GREEN }}
          aria-hidden
        />
      ) : null}

      <span
        className={cn(
          'shrink-0 text-center font-mono tabular-nums text-muted-foreground lg:col-start-1',
          compact ? 'w-5 text-[11px]' : 'w-7 text-sm lg:w-auto',
        )}
        aria-label={`${ordinalPlace(place)} place`}
      >
        {place}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-3 lg:col-start-2">
        <MemberIdentity
          userId={member.userId}
          disableLinks={disableProfileLinks}
          ariaLabel={`${member.name}'s profile`}
          className="shrink-0"
        >
          <UserAvatarImage
            avatar={member.avatar}
            customAvatarUrl={member.customAvatarUrl}
            fallbackInitials={member.userId ? null : member.name}
            fallbackColorKey={member.userId || member.name}
            className={cn(
              compact ? 'h-6 w-6' : 'h-9 w-9',
              member.isYou && 'ring-2 ring-primary/60',
            )}
          />
        </MemberIdentity>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <MemberIdentity
              userId={member.userId}
              disableLinks={disableProfileLinks}
              className={cn(
                'font-medium leading-snug break-words text-white',
                compact ? 'text-[11px]' : 'text-sm',
                !disableProfileLinks && 'hover:underline',
              )}
            >
              {member.name}
            </MemberIdentity>
            {member.isYou ? (
              <span
                className={cn(
                  'shrink-0 rounded-full bg-primary/20 font-semibold uppercase tracking-wide text-primary',
                  compact
                    ? 'px-1 py-px text-[8px]'
                    : 'px-1.5 py-0.5 text-[10px]',
                )}
              >
                You
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {compact ? (
        <>
          {trend}
          {pointsBlock}
        </>
      ) : (
        <>
          {/* Mobile trailing cluster (flex); desktop cells via lg:contents → grid. */}
          <div className="flex shrink-0 items-center gap-3 lg:contents">
            <div className="lg:hidden">{trend}</div>
            <div className="lg:hidden">{pointsBlock}</div>
            <div className="hidden lg:col-start-3 lg:block lg:justify-self-end">
              {pointsBlock}
            </div>
            <div className="hidden min-w-0 lg:col-start-4 lg:block">
              {trend}
            </div>
            <div className="hidden min-w-0 lg:col-start-5 lg:block">
              <LastPickCell pick={member.lastPick} />
            </div>
          </div>
        </>
      )}
    </li>
  )
}

export type PoolLeaderboardStandingsProps = {
  members: LeaderboardMember[]
  acceptingMembers: boolean
  copied: boolean
  onInvite: () => void
  showPreMatchNote?: boolean
  className?: string
  /** Enables "Share my rank" for the current user's standing. */
  poolId?: string
  inviteCode?: string
  /**
   * Marketing / landing preview: render names & avatars as static chrome
   * (no `/u/[id]` links). Does not fetch or poll — data still comes from props.
   */
  disableProfileLinks?: boolean
  /**
   * Landing-only: replace the 1st-place podium avatar (no ring/crown) with this
   * free-standing figure (e.g. `/mascot/pucky_trophy.png`). In-app unused.
   */
  firstPlaceFigureSrc?: string
  /**
   * Tight miniature (login panel, etc.) — same podium DNA + YOU row treatment,
   * smaller avatars/pedestals; hides exact/fire/movement chrome.
   */
  compact?: boolean
  /** Cap list rows below the podium (default: all). Login uses 2. */
  maxListRows?: number
}

/**
 * Podium (top 3, floating on page bg) + full-bleed ranked list (4th+)
 * with own-row highlight, rank movement, and climb-streak fire (list only).
 */
export function PoolLeaderboardStandings({
  members,
  acceptingMembers,
  copied,
  onInvite,
  showPreMatchNote = false,
  className,
  poolId: _poolId,
  inviteCode: _inviteCode,
  disableProfileLinks = false,
  firstPlaceFigureSrc,
  compact = false,
  maxListRows,
}: PoolLeaderboardStandingsProps) {
  // poolId / inviteCode retained for callers; Share-my-rank control removed.
  void _poolId
  void _inviteCode

  if (members.length === 0) {
    return (
      <div className={cn('px-4 py-12 text-center', className)}>
        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No members yet</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Invite friends to fill the podium.
        </p>
        {acceptingMembers ? (
          <Button
            type="button"
            className="mt-5 gap-2"
            onClick={onInvite}
            variant={copied ? 'default' : 'outline'}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Link copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Invite friends
              </>
            )}
          </Button>
        ) : null}
      </div>
    )
  }

  const ordered = flattenStandings(members)
  const podiumSlots = ordered.slice(0, Math.min(3, ordered.length))
  const restAll = ordered.slice(3)
  const rest =
    typeof maxListRows === 'number' ? restAll.slice(0, maxListRows) : restAll

  const first = podiumSlots[0] ?? null
  const second = podiumSlots[1] ?? null
  const third = podiumSlots[2] ?? null

  const podiumInner = (
    <div className="flex items-end justify-center">
      {second ? (
        <PodiumPedestal
          place={2}
          member={second.member}
          disableProfileLinks={disableProfileLinks}
          omitCrownSpacer={Boolean(firstPlaceFigureSrc) || compact}
          compact={compact}
        />
      ) : null}
      {first ? (
        <PodiumPedestal
          place={1}
          member={first.member}
          disableProfileLinks={disableProfileLinks}
          firstPlaceFigureSrc={firstPlaceFigureSrc}
          compact={compact}
        />
      ) : null}
      {third ? (
        <PodiumPedestal
          place={3}
          member={third.member}
          disableProfileLinks={disableProfileLinks}
          omitCrownSpacer={Boolean(firstPlaceFigureSrc) || compact}
          compact={compact}
        />
      ) : null}
    </div>
  )

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        compact ? 'bg-transparent' : POOL_DESKTOP_CANVAS_CLASS,
        className,
      )}
    >
      {/* Mobile / compact / landing: podium unchanged (no stadium card). */}
      <section
        aria-label="Top standings podium"
        className={cn(
          'mx-auto w-full max-w-4xl shrink-0',
          compact
            ? 'px-1 pt-0'
            : firstPlaceFigureSrc
              ? 'px-4 pt-3'
              : 'px-4 pt-2 lg:hidden',
        )}
      >
        {podiumInner}
      </section>

      {/* Desktop in-app: stadium podium card — edges match top bar via shared rail. */}
      {!compact && !firstPlaceFigureSrc ? (
        <section
          aria-label="Top standings podium"
          className={cn(
            'mx-auto hidden w-full shrink-0 pt-1 lg:block',
            POOL_LEADERBOARD_DESKTOP_CONTENT_RAIL_CLASS,
          )}
        >
          <div className="leaderboard-podium-stadium relative overflow-hidden rounded-2xl border border-[#292929]">
            <div className="leaderboard-podium-stadium__bg" aria-hidden />
            <div className="leaderboard-podium-stadium__overlay" aria-hidden />
            <div className="leaderboard-podium-stadium__confetti" aria-hidden>
              {/* Ambient full-card drift (normal rate). */}
              <LoginPanelConfetti density="normal" />
              {/* Concentrated stream over the three pedestals (~2.5× ambient). */}
              <LoginPanelConfetti
                density="dense"
                originXRange={LEADERBOARD_PODIUM_CONFETTI_X_RANGE}
              />
            </div>
            <div className="leaderboard-podium-stadium__content px-4 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7">
              {podiumInner}
            </div>
          </div>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <section
          aria-label="Full standings"
          className={cn(
            'flex min-h-0 w-full flex-1 flex-col',
            compact
              ? 'mt-2 overflow-hidden rounded-lg bg-black/25'
              : cn(
                  'mt-5 rounded-t-[2rem] sm:rounded-t-[2.5rem]',
                  POOL_DESKTOP_CANVAS_CLASS,
                  // Desktop: shared rail so card edges match top bar + podium
                  'lg:mt-5 lg:rounded-none lg:bg-transparent',
                  POOL_LEADERBOARD_DESKTOP_CONTENT_RAIL_CLASS,
                ),
          )}
        >
          <div
            className={cn(
              !compact &&
                'lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[#292929] lg:bg-[#141414] lg:pb-2',
            )}
          >
          {/* Desktop column header */}
          {!compact ? (
            <div
              className={cn(
                'hidden border-b border-white/[0.06] bg-white/[0.03] px-5 py-2.5 lg:grid',
                'lg:grid-cols-[3.5rem_minmax(0,1.5fr)_5.5rem_5.75rem_minmax(9.5rem,1.15fr)] lg:items-center lg:gap-x-6',
              )}
              role="row"
            >
              {(
                [
                  ['Position', 'lg:col-start-1'],
                  ['Member', 'lg:col-start-2'],
                  ['Points', 'lg:col-start-3 lg:justify-self-end lg:text-right'],
                  ['Trend', 'lg:col-start-4'],
                  ['Last Pick', 'lg:col-start-5'],
                ] as const
              ).map(([label, col]) => (
                <span
                  key={label}
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70',
                    col,
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          <ul className="w-full shrink-0 divide-y divide-white/[0.06]">
            {rest.map(({ place, member }) => (
              <StandingListRow
                key={member.id}
                place={place}
                member={member}
                disableProfileLinks={disableProfileLinks}
                compact={compact}
              />
            ))}
          </ul>
          {!compact ? (
            <div
              className={cn('min-h-0 flex-1 lg:hidden', POOL_DESKTOP_CANVAS_CLASS)}
              aria-hidden
            />
          ) : null}

          {showPreMatchNote ? (
            <p className="shrink-0 px-4 pb-2 text-center text-sm text-muted-foreground">
              Scores will update automatically after each match.
            </p>
          ) : null}

          {acceptingMembers ? (
            <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-6 pt-2 lg:max-w-none">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-primary/25 bg-primary/5 px-4 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    More players, more rivalry
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Invite friends to climb the podium with you.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2 shrink-0 gap-2 sm:mt-0"
                  onClick={onInvite}
                  variant={copied ? 'default' : 'outline'}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Invite friends
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
          </div>
        </section>
      ) : (
        <>
          {showPreMatchNote ? (
            <p className="px-4 text-center text-sm text-muted-foreground">
              Scores will update automatically after each match.
            </p>
          ) : null}
          {acceptingMembers ? (
            <div className="mx-auto max-w-4xl px-4 pb-6">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-primary/25 bg-primary/5 px-4 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    More players, more rivalry
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Invite friends to climb the podium with you.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2 shrink-0 gap-2 sm:mt-0"
                  onClick={onInvite}
                  variant={copied ? 'default' : 'outline'}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Invite friends
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
