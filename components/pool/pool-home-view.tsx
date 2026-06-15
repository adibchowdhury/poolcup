'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useClientNow } from '@/hooks/use-client-now'
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Flame,
  Trophy,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PoolActivityFeed } from '@/components/pool/pool-activity-feed'
import { type LeaderboardMember } from '@/components/pool/leaderboard-row'
import {
  buildLeaderboardPlaceGroups,
  LeaderboardGroupedList,
} from '@/components/pool/leaderboard-grouped-list'
import { LeaderboardSkeleton } from '@/components/pool/leaderboard-skeleton'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'
import { ScoringModeBadge } from '@/components/pool/scoring-mode-badge'
import type { UserPoolPrediction } from '@/components/pool/prediction-match-card'
import { PoolPredictionsTab } from '@/components/pool/pool-predictions-tab'
import type { WinnerGroupPrediction } from '@/components/pool/your-predictions-section'
import { trackEvent } from '@/src/lib/track'

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
  avatarsByMemberId: Map<string, string | null>
}

function formatNextMatchCountdown(ms: number): string {
  if (ms <= 0) return 'Soon'
  const totalMinutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function PoolNextMatchCountdown({ kickoffAt }: { kickoffAt: string }) {
  const { mounted, nowMs } = useClientNow(60_000)

  const label = mounted
    ? formatNextMatchCountdown(new Date(kickoffAt).getTime() - nowMs)
    : '—'

  return (
    <span className="text-sm font-medium" suppressHydrationWarning>
      Next match in {label}
    </span>
  )
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
  avatarsByMemberId,
}: PoolHomeViewProps) {
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('predictions')

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

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-20 top-40 h-96 w-96 rounded-full bg-[#ffb300]/5 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="group rounded-lg p-2 transition-colors hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </Link>
              <div className="min-w-0 flex-1">
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
              {canDelete && poolId && (
                <DeletePoolDialog
                  poolId={poolId}
                  poolName={pool.name}
                  redirectTo="/dashboard"
                  triggerVariant="outline"
                />
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-4xl overflow-x-hidden px-4 py-8">
          <div className="mb-8 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 hover-lift">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {pool.memberCount} {pool.memberCount === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 hover-lift">
              <Calendar className="h-4 w-4 text-[#ffb300]" />
              {pool.matchesPlayed === 0 && pool.nextMatchKickoffAt ? (
                <PoolNextMatchCountdown kickoffAt={pool.nextMatchKickoffAt} />
              ) : (
                <span className="text-sm font-medium">
                  {pool.matchesPlayed} Matches played
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 hover-lift">
              <span
                className="stage-live-dot h-2.5 w-2.5 shrink-0 rounded-full"
                aria-hidden
              />
              <span className="text-sm font-medium">
                Currently in: {pool.stage}
              </span>
            </div>
          </div>

          {!hasPredictions && (
            <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
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

          {yourData && yourData.points > 0 && (
            <div className="mb-8 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card to-[#ffb300]/10 p-6">
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
          )}

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="mb-8 w-full min-w-0 gap-6"
          >
            <TabsList className="grid h-auto w-full max-w-2xl grid-cols-3 p-1">
              <TabsTrigger value="predictions" className="px-2 py-2 text-xs sm:text-sm">
                Predictions
              </TabsTrigger>
              <TabsTrigger value="feed" className="px-2 py-2 text-xs sm:text-sm">
                Feed
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="px-2 py-2 text-xs sm:text-sm">
                Leaderboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="predictions" className="mt-0 w-full min-w-0">
              <PoolPredictionsTab
                scoringStyle={pool.scoringStyle}
                predictions={userPredictions}
                winnerGroups={winnerGroups}
                thirdPlaceTeams={thirdPlaceTeams}
                totalMatches={pool.totalMatches}
                predictHref={predictHref}
                poolId={poolId}
                currentUserId={currentUserId}
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

            <TabsContent value="feed" className="mt-0 w-full min-w-0">
              {poolId ? (
                <PoolActivityFeed
                  poolId={poolId}
                  inviteCode={pool.inviteCode}
                  currentUserId={currentUserId}
                  avatarsByMemberId={avatarsByMemberId}
                />
              ) : null}
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
          </Tabs>
        </main>
      </div>
    </div>
  )
}
