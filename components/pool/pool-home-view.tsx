'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Check,
  Copy,
  Flame,
  Trophy,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type LeaderboardMember } from '@/components/pool/leaderboard-row'
import {
  buildLeaderboardPlaceGroups,
  LeaderboardGroupedList,
} from '@/components/pool/leaderboard-grouped-list'
import { LeaderboardSkeleton } from '@/components/pool/leaderboard-skeleton'
import { LiveScoreboard } from '@/components/dashboard/live-scoreboard'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'
import { ScoringModeBadge } from '@/components/pool/scoring-mode-badge'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { PoolPredictionsTab } from '@/components/pool/pool-predictions-tab'
import {
  PoolChatTab,
  type PoolChatMemberProfile,
} from '@/components/pool/pool-chat-tab'
import type { WinnerGroupPrediction } from '@/components/pool/your-predictions-section'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/src/lib/track'
import { useMobileChatChrome } from '@/src/lib/mobile-chat-chrome-context'
import { emitPoolMarkedRead, markPoolRead } from '@/src/lib/pool-unread-counts'
import { supabase } from '@/src/lib/supabase'

export type PoolHomeMeta = {
  inviteCode: string
  name: string
  scoringStyle: string
  stage: string
  memberCount: number
  matchesPlayed: number
  totalMatches: number
  nextMatchIn: string | null
  nextMatchKickoffAt: string | null
}

interface PoolHomeViewProps {
  pool: PoolHomeMeta
  members: LeaderboardMember[]
  userPredictions: UserPoolPrediction[]
  winnerGroups: WinnerGroupPrediction[]
  thirdPlaceTeams: string[]
  predictHref: string
  hasPredictions: boolean
  currentUserId: string
  leaderboardLoading?: boolean
  canDelete?: boolean
  poolId?: string
  memberId?: string
  onPredictionSaved?: (
    matchId: string,
    predTeam1: number,
    predTeam2: number,
  ) => void
  onPredictionRemoved?: (matchId: string) => void
  avatarsByMemberId: Map<string, string | null>
  poolCreatorUserId?: string
  memberProfilesByUserId?: Map<string, PoolChatMemberProfile>
}

export function PoolHomeView({
  pool,
  members,
  userPredictions,
  winnerGroups,
  thirdPlaceTeams,
  predictHref,
  hasPredictions,
  currentUserId,
  leaderboardLoading = false,
  canDelete,
  poolId,
  memberId,
  onPredictionSaved,
  onPredictionRemoved,
  avatarsByMemberId,
  poolCreatorUserId,
  memberProfilesByUserId,
}: PoolHomeViewProps) {
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab')
    if (tab === 'chat' || tab === 'leaderboard' || tab === 'predictions') {
      return tab
    }
    return 'predictions'
  })

  const copyInviteLink = () => {
    const joinUrl = `${window.location.origin}/join/${pool.inviteCode}`
    navigator.clipboard.writeText(joinUrl)
    trackEvent('invite_link_copied', {
      poolId: poolId ?? null,
      metadata: { source: 'pool_page' },
    })
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const yourData = members.find((m) => m.isYou)
  const isWinnerPool = pool.scoringStyle === 'winner'
  const hasResults =
    pool.matchesPlayed > 0 ||
    (isWinnerPool && members.some((member) => member.points > 0))
  const showPreMatchLeaderboardNote = !hasResults && members.length > 0
  const yourPlaceGroup = yourData
    ? buildLeaderboardPlaceGroups(members).find((group) =>
        group.members.some((member) => member.id === yourData.id),
      )
    : undefined
  const yourRank = yourPlaceGroup?.place ?? 0
  const showChatTab = Boolean(memberId && poolId && poolCreatorUserId && memberProfilesByUserId)
  const isMobileChatShell = activeTab === 'chat' && showChatTab
  const { setMobileChatActive } = useMobileChatChrome()

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'chat') {
      setActiveTab(showChatTab ? 'chat' : 'predictions')
      return
    }
    if (tab === 'leaderboard' || tab === 'predictions') {
      setActiveTab(tab)
    }
  }, [searchParams, showChatTab])

  useEffect(() => {
    setMobileChatActive(isMobileChatShell)
    return () => setMobileChatActive(false)
  }, [isMobileChatShell, setMobileChatActive])

  useEffect(() => {
    if (activeTab !== 'chat' || !poolId) return

    emitPoolMarkedRead(poolId)
    void markPoolRead(supabase, poolId)
  }, [activeTab, poolId])

  return (
    <div
      className={cn(
        'min-h-screen bg-background',
        isMobileChatShell &&
          'max-sm:flex max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden',
      )}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-20 top-40 h-96 w-96 rounded-full bg-[#ffb300]/5 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div
        className={cn(
          'relative z-10',
          isMobileChatShell &&
            'max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden',
        )}
      >
        <header
          className={cn(
            'sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl',
            isMobileChatShell && 'max-sm:shrink-0',
          )}
        >
          <div className="mx-auto max-w-4xl px-4 py-4 max-sm:py-2.5">
            <div className="flex items-center gap-4 max-sm:items-start max-sm:gap-2">
              <Link
                href="/dashboard"
                className="group shrink-0 rounded-lg p-2 transition-colors hover:bg-muted max-sm:p-1.5"
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="hidden sm:block">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl tracking-wide text-foreground sm:text-3xl">
                      {pool.name}
                    </h1>
                    <ScoringModeBadge scoringStyle={pool.scoringStyle} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Invite:</span>
                    <code className="font-mono text-primary">{pool.inviteCode}</code>
                  </div>
                </div>
                <div className="sm:hidden">
                  <h1 className="truncate font-display text-lg tracking-wide text-foreground">
                    {pool.name}
                  </h1>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    <ScoringModeBadge
                      scoringStyle={pool.scoringStyle}
                      className="shrink-0"
                    />
                    <div className="flex min-w-0 items-center gap-1.5 truncate rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                      <span className="shrink-0">Invite:</span>
                      <code className="truncate font-mono text-primary">
                        {pool.inviteCode}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
              {canDelete && poolId && (
                <DeletePoolDialog
                  poolId={poolId}
                  poolName={pool.name}
                  redirectTo="/dashboard"
                  triggerVariant="outline"
                  mobileIconOnly
                />
              )}
            </div>
          </div>
        </header>

        <main
          className={cn(
            'mx-auto w-full min-w-0 max-w-4xl overflow-x-hidden px-4 py-8',
            'max-sm:pt-0 max-sm:pb-8',
            isMobileChatShell &&
              'max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-hidden max-sm:px-0 max-sm:py-0 max-sm:pb-0',
          )}
        >
          {!hasPredictions && isWinnerPool && (
            <div
              className={cn(
                'mb-8 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between',
                isMobileChatShell && 'max-sm:hidden',
              )}
            >
              <p className="text-sm font-medium text-foreground">
                You haven&apos;t made your predictions yet
              </p>
              <Button
                asChild
                size="sm"
                className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Link href={predictHref}>Predict Now</Link>
              </Button>
            </div>
          )}

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className={cn(
              'mb-8 w-full min-w-0 gap-6',
              isMobileChatShell &&
                'max-sm:mb-0 max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:gap-2 max-sm:overflow-x-hidden max-sm:overflow-hidden',
            )}
          >
            <div
              className={cn(
                'max-sm:mt-3',
                isMobileChatShell && 'max-sm:shrink-0 max-sm:px-4',
              )}
            >
              <TabsList
                className={cn(
                  'grid h-auto w-full max-w-2xl p-1',
                  showChatTab ? 'grid-cols-3' : 'grid-cols-2',
                  isMobileChatShell && 'max-sm:max-w-none max-sm:shrink-0',
                )}
              >
                <TabsTrigger value="predictions" className="px-2 py-2 text-xs sm:text-sm">
                  Predictions
                </TabsTrigger>
                <TabsTrigger value="leaderboard" className="px-2 py-2 text-xs sm:text-sm">
                  Leaderboard
                </TabsTrigger>
                {showChatTab ? (
                  <TabsTrigger value="chat" className="px-2 py-2 text-xs sm:text-sm">
                    Chat
                  </TabsTrigger>
                ) : null}
              </TabsList>
            </div>

            {activeTab === 'leaderboard' && yourData && yourData.points > 0 ? (
              <div className="hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card to-[#ffb300]/10 p-6 sm:block">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">Your Position</div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-display text-5xl text-primary">
                        #{yourRank}
                      </span>
                      <div>
                        <div className="font-display text-2xl text-foreground">
                          {yourData.points} pts
                        </div>
                        {!isWinnerPool ? (
                          <div className="text-sm text-muted-foreground">
                            {yourData.correctPredictions}/{yourData.totalPredictions}{' '}
                            correct
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {yourData.streak >= 2 && (
                    <div className="rounded-xl border border-[#ffb300]/30 bg-[#ffb300]/20 p-4 text-center">
                      <Flame className="mx-auto mb-1 h-8 w-8 text-[#ffb300]" />
                      <div className="font-display text-xl text-[#ffb300]">
                        {yourData.streak}
                      </div>
                      <div className="text-xs text-[#ffb300]/80">streak</div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <TabsContent value="predictions" className="mt-0 w-full min-w-0">
              <PoolPredictionsTab
                scoringStyle={pool.scoringStyle}
                predictions={userPredictions}
                totalMatchCount={pool.totalMatches}
                winnerGroups={winnerGroups}
                thirdPlaceTeams={thirdPlaceTeams}
                predictHref={predictHref}
                poolId={poolId}
                memberId={memberId}
                currentUserId={currentUserId}
                onPredictionSaved={onPredictionSaved}
                onPredictionRemoved={onPredictionRemoved}
                shareOpen={shareOpen}
                onToggleShare={() => setShareOpen((o) => !o)}
                inviteCopySlot={
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h3 className="mb-4 font-display text-lg">Invite Friends</h3>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3">
                        <span className="text-sm text-muted-foreground">/join/</span>
                        <span className="font-mono font-medium text-primary">
                          {pool.inviteCode}
                        </span>
                      </div>
                      <Button
                        type="button"
                        onClick={copyInviteLink}
                        variant={copied ? 'default' : 'outline'}
                        className="gap-2"
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Share this link with friends so they can join your prediction pool
                    </p>
                  </div>
                }
              />
            </TabsContent>

            <TabsContent value="leaderboard" className="mt-0 w-full min-w-0">
              {leaderboardLoading ? (
                <LeaderboardSkeleton />
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary opacity-30 blur-lg" />
                      <Trophy className="relative h-6 w-6 text-primary" />
                    </div>
                    <h2 className="font-display text-2xl tracking-wide text-foreground">
                      LEADERBOARD
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent" />
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary" />

                    <div className="p-2">
                      {members.length === 0 ? (
                        <div className="py-12 text-center">
                          <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                          <p className="text-muted-foreground">No members yet</p>
                          <p className="text-sm text-muted-foreground/60">
                            Share the invite code to get started!
                          </p>
                        </div>
                      ) : (
                        <>
                          <LeaderboardGroupedList
                            members={members}
                            isClassicPool={!isWinnerPool}
                          />

                          {showPreMatchLeaderboardNote && (
                            <p className="mt-4 px-2 pb-2 text-center text-sm text-muted-foreground">
                              Scores will update automatically after each match.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {showChatTab && poolId && poolCreatorUserId && memberProfilesByUserId ? (
              <TabsContent
                value="chat"
                className={cn(
                  'mt-0 w-full min-w-0',
                  'max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-hidden',
                )}
              >
                <div className="mb-4 py-3 max-sm:shrink-0 max-sm:px-4">
                  <LiveScoreboard compact />
                </div>
                <PoolChatTab
                  hideHeading
                  fullBleedMobile
                  poolId={poolId}
                  currentUserId={currentUserId}
                  poolCreatorUserId={poolCreatorUserId}
                  memberProfilesByUserId={memberProfilesByUserId}
                />
              </TabsContent>
            ) : null}
          </Tabs>
        </main>
      </div>
    </div>
  )
}
