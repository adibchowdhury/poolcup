'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Check, Copy, Crown, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import {
  buildLeaderboardPlaceGroups,
  ordinalPlace,
} from '@/components/pool/leaderboard-grouped-list'
import { Button } from '@/components/ui/button'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { SignedShareButton } from '@/components/share/signed-share-button'

const CLIMB_STREAK_FIRE_MIN = 3

/** Active primary accent (follows Pro theme / pool scope). */
const ACCENT_GREEN = 'var(--primary)'
const RING_SILVER = '#c0c6d0'
const RING_BRONZE = '#c47a3d'

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
}: {
  place: 1 | 2 | 3
  member: LeaderboardMember
  disableProfileLinks?: boolean
  /** Landing-only: show a free-standing mascot figure instead of the 1st avatar ring. */
  firstPlaceFigureSrc?: string
  /** Landing mascot podium: drop 2nd/3rd crown-alignment spacer so winners sit higher. */
  omitCrownSpacer?: boolean
}) {
  const isFirst = place === 1
  const useMascotFigure = isFirst && Boolean(firstPlaceFigureSrc)
  const avatarSize = isFirst
    ? 'h-[5.5rem] w-[5.5rem] sm:h-24 sm:w-24'
    : 'h-[4.25rem] w-[4.25rem] sm:h-[4.75rem] sm:w-[4.75rem]'

  // Classic tier heights — 1st tallest, 2nd medium, 3rd shortest.
  // Landing Pucky podium: extra-tall 1st pedestal for more elevation.
  const pedestalH =
    place === 1
      ? useMascotFigure
        ? 'h-[6.75rem] sm:h-[8.25rem]'
        : 'h-[4.75rem] sm:h-[5.75rem]'
      : place === 2
        ? 'h-[3.25rem] sm:h-[4rem]'
        : 'h-[2.25rem] sm:h-[2.75rem]'

  const placeLabel = place === 1 ? '1ST' : place === 2 ? '2ND' : '3RD'

  // 1st green (+ glow), 2nd silver, 3rd bronze.
  const ringColor =
    place === 1 ? ACCENT_GREEN : place === 2 ? RING_SILVER : RING_BRONZE
  const ringShadow =
    place === 1
      ? `0 0 22px color-mix(in srgb, var(--primary) 65%, transparent), 0 0 6px color-mix(in srgb, var(--primary) 90%, transparent)`
      : place === 2
        ? `0 0 10px rgba(192,198,208,0.3)`
        : `0 0 10px rgba(196,122,61,0.3)`

  return (
    <div
      className={cn(
        'flex flex-col items-center px-1 sm:px-1.5',
        isFirst
          ? useMascotFigure
            ? 'order-2 w-[42%] max-w-[14rem] sm:max-w-[16rem]'
            : 'order-2 w-[36%] max-w-[10.5rem] sm:max-w-[12rem]'
          : null,
        place === 2 ? 'order-1 w-[32%] max-w-[9.5rem] sm:max-w-[10.5rem]' : null,
        place === 3 ? 'order-3 w-[32%] max-w-[9.5rem] sm:max-w-[10.5rem]' : null,
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
          <div className="relative mb-2.5 flex w-full flex-col items-center sm:mb-3">
            {isFirst ? (
              <Crown
                className="mb-1 h-6 w-6 text-[#ffb300] drop-shadow-[0_0_8px_rgba(255,179,0,0.55)] sm:h-7 sm:w-7"
                aria-hidden
              />
            ) : omitCrownSpacer ? null : (
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
                  'rounded-full p-[2px]',
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
                  className={avatarSize}
                />
              </div>
            </MemberIdentity>
          </div>

          <div className="mb-2.5 w-full px-0.5 text-center sm:mb-3">
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
              <MemberIdentity
                userId={member.userId}
                disableLinks={disableProfileLinks}
                className={cn(
                  'max-w-full text-center text-[13px] font-semibold leading-snug break-words text-white sm:text-sm',
                  !disableProfileLinks && 'hover:underline',
                )}
              >
                {member.name}
              </MemberIdentity>
            </div>
            {member.isYou ? (
              <span className="mt-1 inline-block rounded-full bg-primary/20 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">
                You
              </span>
            ) : null}
            <p
              className="mt-1.5 font-mono text-xl tabular-nums tracking-wide sm:text-2xl"
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
      )}

      {/* Tiered podium base — sits on app canvas; slightly lighter face + thin green top edge */}
      <div
        className={cn(
          'relative flex w-full flex-col items-center overflow-hidden rounded-t-md',
          pedestalH,
        )}
        style={{
          background:
            'linear-gradient(180deg, #15201c 0%, #101616 45%, #0d1212 100%)',
          boxShadow:
            'inset 0 1px 0 color-mix(in srgb, var(--primary) 35%, transparent)',
        }}
        aria-hidden
      >
        <div
          className="h-[2px] w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${ACCENT_GREEN} 20%, ${ACCENT_GREEN} 80%, transparent 100%)`,
            opacity: isFirst ? 0.95 : 0.7,
          }}
        />
        <span
          className={cn(
            'mt-2 font-display tracking-[0.14em] text-white/90',
            isFirst ? 'text-[11px] sm:text-xs' : 'text-[10px] sm:text-[11px]',
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
}: {
  place: number
  member: LeaderboardMember
  disableProfileLinks?: boolean
}) {
  return (
    <li
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-3.5',
        member.isYou
          ? 'bg-[color-mix(in_srgb,var(--primary)_18%,var(--app-background))]'
          : !disableProfileLinks && 'hover:bg-white/[0.04]',
      )}
    >
      {member.isYou ? (
        <span
          className="absolute inset-y-0 left-0 w-1 rounded-r-sm"
          style={{ backgroundColor: ACCENT_GREEN }}
          aria-hidden
        />
      ) : null}

      <span
        className="w-7 shrink-0 text-center font-mono text-sm tabular-nums text-muted-foreground"
        aria-label={`${ordinalPlace(place)} place`}
      >
        {place}
      </span>

      <MemberIdentity
        userId={member.userId}
        disableLinks={disableProfileLinks}
        ariaLabel={`${member.name}'s profile`}
        className="shrink-0"
      >
        <UserAvatarImage
          avatar={member.avatar}
          customAvatarUrl={member.customAvatarUrl}
          className={cn(
            'h-9 w-9',
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
              'text-sm font-medium leading-snug break-words text-white',
              !disableProfileLinks && 'hover:underline',
            )}
          >
            {member.name}
          </MemberIdentity>
          {member.isYou ? (
            <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              You
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <RankMovementBadge
          movement={member.movement}
          rankDelta={member.rankDelta}
        />
        <ClimbFireBadge climbStreak={member.climbStreak} />
      </div>

      <div className="w-14 shrink-0 text-right sm:w-16">
        <span
          className="font-mono text-lg tabular-nums sm:text-xl"
          style={{ color: ACCENT_GREEN }}
        >
          {member.points}
        </span>
        <span className="ml-0.5 text-[10px] text-muted-foreground">pts</span>
        {member.exactScores > 0 ? (
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {member.exactScores} exact
          </p>
        ) : null}
      </div>
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
  poolId,
  inviteCode,
  disableProfileLinks = false,
  firstPlaceFigureSrc,
}: PoolLeaderboardStandingsProps) {
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
  const rest = ordered.slice(3)
  const youStanding = ordered.find((row) => row.member.isYou) ?? null

  const first = podiumSlots[0] ?? null
  const second = podiumSlots[1] ?? null
  const third = podiumSlots[2] ?? null

  const shareRankDestination = inviteCode
    ? `/pool/${encodeURIComponent(inviteCode)}?tab=leaderboard`
    : '/dashboard'

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col bg-app-background',
        className,
      )}
    >
      <section
        aria-label="Top standings podium"
        className={cn(
          'mx-auto w-full max-w-4xl shrink-0 px-4',
          firstPlaceFigureSrc ? 'pt-3' : 'pt-2',
        )}
      >
        <div className="flex items-end justify-center">
          {second ? (
            <PodiumPedestal
              place={2}
              member={second.member}
              disableProfileLinks={disableProfileLinks}
              omitCrownSpacer={Boolean(firstPlaceFigureSrc)}
            />
          ) : null}
          {first ? (
            <PodiumPedestal
              place={1}
              member={first.member}
              disableProfileLinks={disableProfileLinks}
              firstPlaceFigureSrc={firstPlaceFigureSrc}
            />
          ) : null}
          {third ? (
            <PodiumPedestal
              place={3}
              member={third.member}
              disableProfileLinks={disableProfileLinks}
              omitCrownSpacer={Boolean(firstPlaceFigureSrc)}
            />
          ) : null}
        </div>
      </section>

      {youStanding && poolId ? (
        <div className="mx-auto flex w-full max-w-4xl justify-center px-4 pt-3">
          <SignedShareButton
            type="leaderboard"
            poolId={poolId}
            destinationUrl={shareRankDestination}
            title={`I'm #${youStanding.place} on PoolCup`}
            text={`${youStanding.member.points} pts · ${ordinalPlace(youStanding.place)} in the pool`}
          />
        </div>
      ) : null}

      {rest.length > 0 ? (
        <section
          aria-label="Full standings"
          className={cn(
            'mt-5 flex min-h-0 w-full flex-1 flex-col',
            'rounded-t-[2rem] bg-app-background sm:rounded-t-[2.5rem]',
          )}
        >
          <ul className="w-full shrink-0 divide-y divide-white/[0.06]">
            {rest.map(({ place, member }) => (
              <StandingListRow
                key={member.id}
                place={place}
                member={member}
                disableProfileLinks={disableProfileLinks}
              />
            ))}
          </ul>
          {/* Fills leftover viewport below the last row with the same list color */}
          <div className="min-h-0 flex-1 bg-app-background" aria-hidden />

          {showPreMatchNote ? (
            <p className="shrink-0 px-4 pb-2 text-center text-sm text-muted-foreground">
              Scores will update automatically after each match.
            </p>
          ) : null}

          {acceptingMembers ? (
            <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-6 pt-2">
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
