'use client'

import { useState } from 'react'
import { ArrowLeft, MessageCircle, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  LiveScoreboardCard,
  LiveScoreboardSkeleton,
  useFeaturedMatch,
} from '@/components/dashboard/live-scoreboard'
import { MatchRoomBonusPanel } from '@/components/pool/match-room-bonus-panel'
import {
  MatchRoomLockTally,
  MatchRoomPicksPanel,
} from '@/components/pool/match-room-picks-panel'
import { isMatchKickedOff } from '@/src/lib/match-lock'
import {
  normalizeMatchScoringStyle,
  type MatchScoringStyle,
} from '@/src/lib/prediction-scoring'
import {
  PoolChatTab,
  type PoolChatMemberProfile,
} from '@/components/pool/pool-chat-tab'
import { useClientNow } from '@/hooks/use-client-now'
import type { MemberAvatarRecord } from '@/src/lib/pool-leaderboard'

type PoolMatchRoomProps = {
  poolId: string
  memberId: string
  poolName: string
  scoringStyle: string
  memberCount: number
  currentUserId: string
  poolCreatorUserId: string
  memberProfilesByUserId: Map<string, PoolChatMemberProfile>
  avatarsByMemberId: Map<string, MemberAvatarRecord>
  onClose: () => void
}

function MatchRoomChatPanel({
  poolId,
  currentUserId,
  poolCreatorUserId,
  memberProfilesByUserId,
}: {
  poolId: string
  currentUserId: string
  poolCreatorUserId: string
  memberProfilesByUserId: Map<string, PoolChatMemberProfile>
}) {
  return (
    <PoolChatTab
      embedded
      poolId={poolId}
      currentUserId={currentUserId}
      poolCreatorUserId={poolCreatorUserId}
      memberProfilesByUserId={memberProfilesByUserId}
    />
  )
}

export function PoolMatchRoom({
  poolId,
  memberId,
  poolName,
  scoringStyle,
  memberCount,
  currentUserId,
  poolCreatorUserId,
  memberProfilesByUserId,
  avatarsByMemberId,
  onClose,
}: PoolMatchRoomProps) {
  const { match, mode, loading, error } = useFeaturedMatch()
  const { mounted, nowMs } = useClientNow(1_000)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)

  const matchScoringStyle: MatchScoringStyle =
    normalizeMatchScoringStyle(scoringStyle)

  const hasKickedOff =
    mounted &&
    match != null &&
    isMatchKickedOff(match.locked_at, match.kickoff_at, nowMs)

  const canRevealPicks = hasKickedOff

  const chatProps = {
    poolId,
    currentUserId,
    poolCreatorUserId,
    memberProfilesByUserId,
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0"
            aria-label="Back to pool"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <p className="font-display text-lg tracking-wide text-foreground sm:text-xl">
                Match Room
              </p>
            </div>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {poolName}
            </p>
          </div>

          <Sheet open={mobileChatOpen} onOpenChange={setMobileChatOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-2 lg:hidden"
              >
                <MessageCircle className="h-4 w-4" />
                Chat
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="flex h-[min(85dvh,32rem)] flex-col rounded-t-2xl p-4"
            >
              <SheetHeader className="shrink-0">
                <SheetTitle>Pool chat</SheetTitle>
              </SheetHeader>
              <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
                <MatchRoomChatPanel {...chatProps} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:max-w-none lg:px-8">
            {loading ? (
              <LiveScoreboardSkeleton />
            ) : error || !match || !mode ? (
              <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No featured match available right now.
                </p>
              </div>
            ) : (
              <LiveScoreboardCard match={match} mode={mode} />
            )}

            {match ? (
              <MatchRoomBonusPanel
                poolId={poolId}
                memberId={memberId}
                matchId={match.id}
                currentUserId={currentUserId}
                lockedAt={match.locked_at}
                kickoffAt={match.kickoff_at}
                isFinal={match.is_final || mode === 'final'}
                resultTeam1={match.result_team1}
                resultTeam2={match.result_team2}
              />
            ) : null}

            {match && canRevealPicks ? (
              <MatchRoomPicksPanel
                poolId={poolId}
                matchId={match.id}
                scoringStyle={matchScoringStyle}
                currentUserId={currentUserId}
                avatarsByMemberId={avatarsByMemberId}
                isFinal={match.is_final || mode === 'final'}
                resultTeam1={match.result_team1}
                resultTeam2={match.result_team2}
              />
            ) : match && !canRevealPicks ? (
              <MatchRoomLockTally
                poolId={poolId}
                matchId={match.id}
                memberCount={memberCount}
              />
            ) : null}
          </div>
        </div>

        <aside className="hidden min-h-0 w-full max-w-sm shrink-0 flex-col border-l border-border bg-card/30 p-4 lg:flex">
          <h3 className="mb-3 shrink-0 font-display text-sm tracking-wide text-muted-foreground uppercase">
            Pool chat
          </h3>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <MatchRoomChatPanel {...chatProps} />
          </div>
        </aside>
      </div>
    </div>
  )
}
