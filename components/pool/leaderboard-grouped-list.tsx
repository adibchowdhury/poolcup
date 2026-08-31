'use client'

import { useId, useState } from 'react'
import { ChevronDown, Medal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  LeaderboardMember,
  LeaderboardPointBreakdownItem,
} from '@/components/pool/leaderboard-row'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { UserProfileLink } from '@/components/user-profile-link'
import { mlsPlayoffRoundLabel } from '@/src/lib/mls-playoff-rounds'

const MEDAL_COLORS: Record<1 | 2 | 3, string> = {
  1: '#BA7517',
  2: '#888780',
  3: '#D85A30',
}

const ROUND_LABELS: Record<string, string> = {
  group: 'Group stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  third: '3rd Place Playoff',
  final: 'Final',
}

export type LeaderboardPlaceGroup = {
  place: number
  members: LeaderboardMember[]
}

export function ordinalPlace(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

export function buildLeaderboardPlaceGroups(
  members: LeaderboardMember[],
): LeaderboardPlaceGroup[] {
  const byPoints = [...members].sort((a, b) => b.points - a.points)
  const groups: LeaderboardPlaceGroup[] = []
  let place = 1

  for (let index = 0; index < byPoints.length; ) {
    const points = byPoints[index].points
    const tied: LeaderboardMember[] = []

    while (index < byPoints.length && byPoints[index].points === points) {
      tied.push(byPoints[index])
      index += 1
    }

    tied.sort((a, b) => a.name.localeCompare(b.name))
    groups.push({ place, members: tied })
    place += 1
  }

  return groups
}

function formatBreakdownLineLabel(item: LeaderboardPointBreakdownItem): string {
  if (item.displayLabel) {
    return item.displayLabel
  }

  return formatBreakdownMatchLabel(item)
}

function formatBreakdownMatchLabel(item: LeaderboardPointBreakdownItem): string {
  const matchup = `${item.team1Name} vs ${item.team2Name}`
  if (item.round === 'group' && item.groupName) {
    return `Group ${item.groupName}: ${matchup}`
  }
  const roundLabel = mlsPlayoffRoundLabel(item.round) ?? ROUND_LABELS[item.round]
  return roundLabel ? `${roundLabel}: ${matchup}` : matchup
}

function PlaceBadge({ place }: { place: number }) {
  if (place >= 1 && place <= 3) {
    return (
      <Medal
        className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
        style={{ color: MEDAL_COLORS[place as 1 | 2 | 3] }}
        aria-hidden
      />
    )
  }

  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-bold text-muted-foreground"
      aria-hidden
    >
      {place}
    </span>
  )
}

function PlaceHeader({ place, memberCount }: { place: number; memberCount: number }) {
  const ordinal = ordinalPlace(place)
  const title =
    memberCount === 1 ? `${ordinal} place` : `Tied for ${ordinal} place`

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
      <PlaceBadge place={place} />
      <h3 className="text-sm font-semibold text-foreground sm:text-base">{title}</h3>
      {memberCount > 1 ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {memberCount} players
        </span>
      ) : null}
    </div>
  )
}

function MemberAvatar({
  member,
  className,
  imageClassName,
  linkToProfile = true,
}: {
  member: Pick<
    LeaderboardMember,
    'name' | 'avatar' | 'customAvatarUrl' | 'isYou' | 'userId'
  >
  className?: string
  imageClassName?: string
  /** Set false when already inside another link (e.g. chat inbox row). */
  linkToProfile?: boolean
}) {
  const image = (
    <UserAvatarImage
      avatar={member.avatar}
      customAvatarUrl={member.customAvatarUrl}
      fallbackInitials={member.userId ? null : member.name}
      fallbackColorKey={member.userId || member.name}
      className={cn(
        'h-9 w-9 sm:h-10 sm:w-10',
        member.isYou && 'ring-2 ring-primary/40',
        className,
      )}
      imgClassName={imageClassName}
    />
  )

  if (!linkToProfile || !member.userId) return image

  return (
    <UserProfileLink
      userId={member.userId}
      ariaLabel={`${member.name}'s profile`}
      className="shrink-0"
    >
      {image}
    </UserProfileLink>
  )
}

export { MemberAvatar as LeaderboardMemberAvatar }

function MemberNameBlock({ member }: { member: LeaderboardMember }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <UserProfileLink
          userId={member.userId}
          className={cn(
            'truncate font-medium hover:underline',
            member.isYou ? 'text-primary' : 'text-foreground',
          )}
        >
          {member.name}
        </UserProfileLink>
        {member.isYou ? (
          <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
            you
          </span>
        ) : null}
      </div>
    </div>
  )
}

function BreakdownLine({ item }: { item: LeaderboardPointBreakdownItem }) {
  return (
    <li className="border-b border-border/40 px-3 py-2.5 last:border-b-0 sm:px-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-sm font-medium leading-snug text-foreground">
          {formatBreakdownLineLabel(item)}
        </p>
        <p className="text-xs font-semibold text-muted-foreground sm:shrink-0 sm:text-sm">
          {item.reasonLabel ? (
            <>
              {item.reasonLabel} ·{' '}
              <span className="font-mono tabular-nums text-primary">
                +{item.pointsAwarded} pts
              </span>
            </>
          ) : (
            <span className="font-mono tabular-nums text-primary">
              +{item.pointsAwarded} pts
            </span>
          )}
        </p>
      </div>
    </li>
  )
}

function GroupedMemberRowStatic({ member }: { member: LeaderboardMember }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-t border-border/60 px-3 py-3 first:border-t-0 sm:gap-4 sm:px-4',
        member.isYou && 'bg-primary/5',
      )}
    >
      <MemberAvatar member={member} />
      <MemberNameBlock member={member} />
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground transition-[color] duration-300 sm:text-base">
        {member.points} pts
      </span>
    </div>
  )
}

function GroupedMemberRowExpandable({ member }: { member: LeaderboardMember }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const breakdown = (member.pointBreakdown ?? []).filter(
    (item) => item.pointsAwarded > 0,
  )
  const breakdownTotal = breakdown.reduce(
    (sum, item) => sum + item.pointsAwarded,
    0,
  )

  return (
    <div
      className={cn(
        'border-t border-border/60 first:border-t-0',
        member.isYou && 'bg-primary/5',
      )}
    >
      {/*
        Split identity link from expand control so we never nest <a> in <button>.
      */}
      <div className="flex w-full items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4">
        <MemberAvatar member={member} />
        <MemberNameBlock member={member} />
        <button
          type="button"
          className={cn(
            'ml-auto flex shrink-0 items-center gap-2 rounded-md px-1 py-1',
            'transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          )}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={
            open
              ? `Hide ${member.name} points breakdown`
              : `Show ${member.name} points breakdown`
          }
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="text-sm font-semibold tabular-nums text-foreground transition-[color] duration-300 sm:text-base">
            {member.points} pts
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </div>

      <div
        id={panelId}
        role="region"
        aria-label={`${member.name} points breakdown`}
        hidden={!open}
        className="border-t border-border/40 bg-muted/10"
      >
        {breakdown.length === 0 ? (
          member.points > 0 ? (
            <div className="flex justify-end border-t border-border/40 px-3 py-2.5 sm:px-4">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                Total: {member.points} pts
              </span>
            </div>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground sm:px-4">
              No points earned yet
            </p>
          )
        ) : (
          <>
            <ul className="divide-y divide-border/30">
              {breakdown.map((item) => (
                <BreakdownLine key={item.lineId ?? item.matchId} item={item} />
              ))}
            </ul>
            <div className="flex justify-end border-t border-border/40 px-3 py-2.5 sm:px-4">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                Total: {breakdownTotal} pts
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function GroupedMemberRow({
  member,
  expandableBreakdown,
}: {
  member: LeaderboardMember
  expandableBreakdown: boolean
}) {
  if (!expandableBreakdown) {
    return <GroupedMemberRowStatic member={member} />
  }

  return <GroupedMemberRowExpandable member={member} />
}

export function LeaderboardGroupedList({
  members,
  expandableBreakdown = false,
}: {
  members: LeaderboardMember[]
  expandableBreakdown?: boolean
}) {
  const groups = buildLeaderboardPlaceGroups(members)

  if (groups.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 px-2 pb-2 pt-2 sm:space-y-4 sm:px-3">
      {groups.map((group) => (
        <section
          key={group.place}
          className="overflow-hidden rounded-xl border border-border/80 bg-muted/20"
          aria-label={
            group.members.length === 1
              ? `${ordinalPlace(group.place)} place`
              : `Tied for ${ordinalPlace(group.place)} place`
          }
        >
          <PlaceHeader place={group.place} memberCount={group.members.length} />
          <div className="border-t border-border/60 bg-card/40">
            {group.members.map((member) => (
              <GroupedMemberRow
                key={member.id}
                member={member}
                expandableBreakdown={expandableBreakdown}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
