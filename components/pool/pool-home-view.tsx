'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  Share2,
  Sparkles,
  Flame,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeaderboardRow, type LeaderboardMember } from '@/components/pool/leaderboard-row'
import { DeletePoolDialog } from '@/components/pool/delete-pool-dialog'

export type PoolHomeMeta = {
  inviteCode: string
  name: string
  stage: string
  memberCount: number
  matchesPlayed: number
  totalMatches: number
  nextMatchIn: string | null
}

interface PoolHomeViewProps {
  pool: PoolHomeMeta
  members: LeaderboardMember[]
  predictHref: string
  canDelete?: boolean
  poolId?: string
}

export function PoolHomeView({
  pool,
  members,
  predictHref,
  canDelete,
  poolId,
}: PoolHomeViewProps) {
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const copyInviteLink = () => {
    const joinUrl = `${window.location.origin}/join/${pool.inviteCode}`
    navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const yourRank = members.findIndex((m) => m.isYou) + 1
  const yourData = members.find((m) => m.isYou)
  const isWaitingForAction =
    members.length === 1 && members[0].points === 0

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
                <h1 className="font-display text-2xl tracking-wide text-foreground sm:text-3xl">
                  {pool.name}
                </h1>
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

        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-8 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 hover-lift">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {pool.memberCount} {pool.memberCount === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 hover-lift">
              <Calendar className="h-4 w-4 text-[#ffb300]" />
              <span className="text-sm font-medium">
                {pool.matchesPlayed} Matches played
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 hover-lift">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{pool.stage}</span>
            </div>
          </div>

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
                      <div className="text-sm text-muted-foreground">
                        {yourData.correctPredictions}/{yourData.totalPredictions}{' '}
                        correct
                      </div>
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

          <div className="mb-8">
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
                ) : isWaitingForAction ? (
                  <div className="space-y-2">
                    <LeaderboardRow
                      member={members[0]}
                      rank={1}
                      isTop3={false}
                    />
                    <div className="mt-4 border-t border-border py-8 text-center">
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ffb300]/20 bg-[#ffb300]/10 px-4 py-2">
                        <Sparkles className="h-4 w-4 text-[#ffb300]" />
                        <span className="text-sm text-[#ffb300]">
                          Waiting for the action to begin
                        </span>
                      </div>
                      <p className="mx-auto max-w-md text-sm text-muted-foreground">
                        Invite your friends and make your predictions before matches
                        start. Points will appear here once games are played!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member, index) => (
                      <LeaderboardRow
                        key={member.id}
                        member={member}
                        rank={index + 1}
                        isTop3={members.length > 2}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Button
              asChild
              size="lg"
              className="group h-16 w-full gap-3 bg-primary font-display text-xl tracking-wide text-primary-foreground hover:bg-primary/90 hover-lift"
            >
              <Link href={predictHref}>
                <Zap className="h-6 w-6" />
                Make Predictions
                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>

            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => setShareOpen((o) => !o)}
              className="group h-16 w-full gap-3 border-2 border-border font-display text-xl tracking-wide hover:border-primary/50 hover-lift"
            >
              <Share2 className="h-6 w-6 transition-transform group-hover:scale-110" />
              Share Pool
            </Button>
          </div>

          {shareOpen && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-6">
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
          )}

          {pool.nextMatchIn && (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-6 py-3">
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">Next match in</span>
                <span className="font-mono text-lg font-bold text-primary">
                  {pool.nextMatchIn}
                </span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
