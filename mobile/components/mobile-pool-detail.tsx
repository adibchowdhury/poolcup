'use client'

import { useEffect, useState } from 'react'
import type { DashboardPoolCardData } from '@/components/dashboard/pool-card'
import { ScoringModeBadge } from '@/components/pool/scoring-mode-badge'
import {
  buildLeaderboardPlaceGroups,
  LeaderboardGroupedList,
} from '@/components/pool/leaderboard-grouped-list'
import type { LeaderboardMember } from '@/components/pool/leaderboard-row'
import { ArrowLeft, Check, Copy, Flame, Trophy, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { poolHasLeaderboardResults } from '@/src/lib/pool-leaderboard'
import { fetchPoolDetailMobile } from '../lib/fetch-pool-detail-mobile'
import { getPoolJoinUrl } from '../lib/pool-join-url'
import { copyTextToClipboard } from '../lib/copy-to-clipboard'
import { supabase } from '../lib/supabase-mobile'
import { MobilePoolAvatarImage } from './mobile-pool-avatar-image'
import { MobileClassicPredictionsReadonly } from './mobile-classic-predictions-readonly'
import { MobileWinnerBracketPredictionsReadonly } from './mobile-winner-bracket-predictions-readonly'
import { MobilePoolPastMatchesPicks } from './mobile-pool-past-matches-picks'
import { MobilePoolSquadReadonly } from './mobile-pool-squad-readonly'

export type MobilePoolSubTab = 'predictions' | 'leaderboard' | 'squad'

type MobilePoolDetailProps = {
  pool: DashboardPoolCardData
  onBack: () => void
}

const SUB_TABS: { id: MobilePoolSubTab; label: string }[] = [
  { id: 'predictions', label: 'Predictions' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'squad', label: 'My Squad' },
]

function PoolSubTabBar({
  activeTab,
  onChange,
}: {
  activeTab: MobilePoolSubTab
  onChange: (tab: MobilePoolSubTab) => void
}) {
  return (
    <div
      className="grid h-auto w-full grid-cols-3 rounded-lg bg-muted p-1 text-muted-foreground"
      role="tablist"
      aria-label="Pool sections"
    >
      {SUB_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-md px-2 py-2 text-xs font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function PredictionsTabContent({
  poolId,
  scoringStyle,
  currentUserId,
  memberId,
}: {
  poolId: string
  scoringStyle: string
  currentUserId: string | null
  memberId: string | null
}) {
  const isClassicPool = scoringStyle !== 'winner'

  return (
    <div className="space-y-6">
      {isClassicPool && memberId ? (
        <MobileClassicPredictionsReadonly poolId={poolId} memberId={memberId} />
      ) : isClassicPool ? (
        <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Join this pool to view your predictions.
        </p>
      ) : memberId && currentUserId ? (
        <MobileWinnerBracketPredictionsReadonly
          poolId={poolId}
          memberId={memberId}
          userId={currentUserId}
        />
      ) : (
        <p className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Join this pool to view your bracket predictions.
        </p>
      )}

      {currentUserId ? (
        <MobilePoolPastMatchesPicks
          poolId={poolId}
          scoringStyle={scoringStyle}
          currentUserId={currentUserId}
        />
      ) : null}
    </div>
  )
}

function LeaderboardTabContent({
  members,
  isWinnerPool,
  matchesPlayed,
  loading,
  error,
  expandableBreakdown,
}: {
  members: LeaderboardMember[]
  isWinnerPool: boolean
  matchesPlayed: number
  loading: boolean
  error: string | null
  expandableBreakdown: boolean
}) {
  const yourData = members.find((member) => member.isYou)
  const hasResults = poolHasLeaderboardResults(
    members,
    matchesPlayed,
    isWinnerPool,
  )
  const showPreMatchNote = !hasResults && members.length > 0
  const yourPlaceGroup = yourData
    ? buildLeaderboardPlaceGroups(members).find((group) =>
        group.members.some((member) => member.id === yourData.id),
      )
    : undefined
  const yourRank = yourPlaceGroup?.place ?? 0

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading leaderboard…</p>
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    )
  }

  if (members.length === 0) {
    return (
      <div className="py-12 text-center">
        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No members yet</p>
        <p className="text-sm text-muted-foreground/60">
          Share the invite link to get started!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {yourData && yourData.points > 0 ? (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card to-[#ffb300]/10 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">
                Your position
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-display text-4xl text-primary">
                  #{yourRank}
                </span>
                <div>
                  <div className="font-display text-xl text-foreground">
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
            {yourData.streak >= 2 ? (
              <div className="rounded-xl border border-[#ffb300]/30 bg-[#ffb300]/20 p-3 text-center">
                <Flame className="mx-auto mb-1 h-7 w-7 text-[#ffb300]" />
                <div className="font-display text-lg text-[#ffb300]">
                  {yourData.streak}
                </div>
                <div className="text-xs text-[#ffb300]/80">streak</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mb-2 flex items-center gap-3">
        <Trophy className="h-6 w-6 text-primary" aria-hidden />
        <h2 className="font-display text-2xl tracking-wide text-foreground">
          LEADERBOARD
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary" />
        <LeaderboardGroupedList
          members={members}
          expandableBreakdown={expandableBreakdown}
        />
      </div>

      {showPreMatchNote ? (
        <p className="text-center text-sm text-muted-foreground">
          Scores will update automatically after each match.
        </p>
      ) : null}
    </div>
  )
}

export function MobilePoolDetail({ pool, onBack }: MobilePoolDetailProps) {
  const [activeTab, setActiveTab] = useState<MobilePoolSubTab>('leaderboard')
  const [members, setMembers] = useState<LeaderboardMember[]>([])
  const [matchesPlayed, setMatchesPlayed] = useState(0)
  const [acceptingMembers, setAcceptingMembers] = useState(true)
  const [poolAvatar, setPoolAvatar] = useState<string | null>(null)
  const [squadName, setSquadName] = useState(pool.name)
  const [creatorUserId, setCreatorUserId] = useState('')
  const [memberCount, setMemberCount] = useState(pool.members)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leaderboardBreakdownExpandable, setLeaderboardBreakdownExpandable] =
    useState(pool.scoringStyle !== 'winner')
  const [copied, setCopied] = useState(false)

  const isWinnerPool = pool.scoringStyle === 'winner'
  const playersLabel = `${memberCount} ${memberCount === 1 ? 'player' : 'players'}`

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (userError || !user) {
        setError(userError?.message ?? 'Could not load your account')
        setMembers([])
        setLoading(false)
        return
      }

      setCurrentUserId(user.id)

      const { meta, members: rows, error: fetchError } = await fetchPoolDetailMobile(
        supabase,
        pool,
        user.id,
      )

      if (cancelled) return

      if (fetchError || !meta) {
        setError(fetchError ?? 'Pool not found')
        setMembers([])
        setLoading(false)
        return
      }

      setMembers(rows)
      setMatchesPlayed(meta.matchesPlayed)
      setAcceptingMembers(meta.acceptingMembers)
      setPoolAvatar(meta.avatar)
      setSquadName(meta.name)
      setCreatorUserId(meta.creatorUserId)
      setMemberCount(meta.memberCount)
      setLeaderboardBreakdownExpandable(meta.leaderboardBreakdownExpandable)
      setError(null)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [pool])

  async function copyInviteLink() {
    if (!acceptingMembers) return
    const ok = await copyTextToClipboard(getPoolJoinUrl(pool.inviteCode))
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  const displayName = squadName

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back to pools"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>

          <MobilePoolAvatarImage
            avatar={poolAvatar}
            size="sm"
            className="shrink-0 rounded-xl"
          />

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg tracking-wide text-foreground">
              {displayName}
            </h1>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <ScoringModeBadge
                scoringStyle={pool.scoringStyle}
                className="shrink-0"
              />
              <span className="text-[10px] text-muted-foreground">
                {playersLabel}
              </span>
            </div>
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              {acceptingMembers ? (
                <>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                    <span className="shrink-0">Invite:</span>
                    <code className="truncate font-mono text-primary">
                      {pool.inviteCode}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyInviteLink()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-muted"
                    aria-label="Copy invite link"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-primary" aria-hidden />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden />
                        Copy link
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  Invites closed
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
        <div className="mx-auto w-full max-w-lg space-y-5">
          <PoolSubTabBar activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'predictions' ? (
            <PredictionsTabContent
              poolId={pool.id}
              scoringStyle={pool.scoringStyle}
              currentUserId={currentUserId}
              memberId={members.find((member) => member.isYou)?.id ?? null}
            />
          ) : null}

          {activeTab === 'leaderboard' ? (
            <LeaderboardTabContent
              members={members}
              isWinnerPool={isWinnerPool}
              matchesPlayed={matchesPlayed}
              loading={loading}
              error={error}
              expandableBreakdown={leaderboardBreakdownExpandable}
            />
          ) : null}

          {activeTab === 'squad' ? (
            loading ? (
              <p className="text-sm text-muted-foreground">Loading squad…</p>
            ) : error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : currentUserId ? (
              <MobilePoolSquadReadonly
                poolId={pool.id}
                squadName={squadName}
                poolAvatar={poolAvatar}
                acceptingMembers={acceptingMembers}
                members={members}
                poolCreatorUserId={creatorUserId}
                currentUserId={currentUserId}
                onPoolNameChange={setSquadName}
                onPoolAvatarChange={setPoolAvatar}
                onAcceptingMembersChange={setAcceptingMembers}
              />
            ) : null
          ) : null}
        </div>
      </div>
    </div>
  )
}
