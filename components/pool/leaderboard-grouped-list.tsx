'use client'

import Image from 'next/image'
import { Medal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import { getAvatarSrc } from '@/src/lib/avatars'

const MEDAL_COLORS: Record<1 | 2 | 3, string> = {
  1: '#BA7517',
  2: '#888780',
  3: '#D85A30',
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

function GroupedMemberRow({ member }: { member: LeaderboardMember }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-t border-border/60 px-3 py-3 first:border-t-0 sm:gap-4 sm:px-4',
        member.isYou && 'bg-primary/5',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold sm:h-10 sm:w-10 sm:text-sm',
          member.isYou
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {member.avatar ? (
          <Image
            src={getAvatarSrc(member.avatar)}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 object-cover object-top"
          />
        ) : (
          member.name.charAt(0).toUpperCase()
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'truncate font-medium',
              member.isYou ? 'text-primary' : 'text-foreground',
            )}
          >
            {member.name}
          </span>
          {member.isYou ? (
            <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
              you
            </span>
          ) : null}
        </div>
      </div>

      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground sm:text-base">
        {member.points} pts
      </span>
    </div>
  )
}

export function LeaderboardGroupedList({
  members,
}: {
  members: LeaderboardMember[]
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
              <GroupedMemberRow key={member.id} member={member} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
