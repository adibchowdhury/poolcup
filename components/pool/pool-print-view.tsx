'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import type {
  LeaderboardExportRow,
  PredictionExportRow,
  PoolExportMeta,
} from '@/src/lib/pool-export'
import {
  formatGeneratedAt,
  formatScoringRules,
} from '@/src/lib/pool-export'

type PoolPrintViewProps = {
  meta: PoolExportMeta
  leaderboard: LeaderboardExportRow[]
  predictions: PredictionExportRow[]
  poolHref: string
}

export function PoolPrintView({
  meta,
  leaderboard,
  predictions,
  poolHref,
}: PoolPrintViewProps) {
  const { iso, human } = formatGeneratedAt(meta.generatedAt)
  const scoring = formatScoringRules(meta)

  useEffect(() => {
    capturePostHog('export_print_view_opened', {
      pool_id: meta.poolId,
    })
  }, [meta.poolId])

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="print:hidden border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Button
            asChild
            type="button"
            size="sm"
            variant="ghost"
            className={cn('h-9', FOCUS_VISIBLE_RING)}
          >
            <Link href={poolHref}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to pool
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn('h-9', FOCUS_VISIBLE_RING)}
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" aria-hidden />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
        <header className="mb-8 space-y-2 border-b border-zinc-200 pb-6 print:mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            PoolCup export
          </p>
          <h1 className="text-3xl font-bold tracking-tight print:text-2xl">
            {meta.name}
          </h1>
          <dl className="grid gap-1 text-sm text-zinc-600 sm:grid-cols-2">
            <div>
              <dt className="inline font-medium text-zinc-800">Competition: </dt>
              <dd className="inline">{meta.eventName || '—'}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-zinc-800">Scoring: </dt>
              <dd className="inline">{scoring}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-zinc-800">Members: </dt>
              <dd className="inline">{meta.memberCount}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-zinc-800">Generated at: </dt>
              <dd className="inline">
                {iso} ({human})
              </dd>
            </div>
          </dl>
        </header>

        <section className="mb-10 print:mb-8" aria-labelledby="print-leaderboard-heading">
          <h2
            id="print-leaderboard-heading"
            className="mb-3 text-xl font-semibold print:text-lg"
          >
            Leaderboard
          </h2>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-zinc-600">No results to export yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-300">
                    <th className="py-2 pr-3 font-semibold">Rank</th>
                    <th className="py-2 pr-3 font-semibold">Name</th>
                    <th className="py-2 pr-3 font-semibold">Username</th>
                    <th className="py-2 pr-3 font-semibold tabular-nums">Points</th>
                    <th className="py-2 pr-3 font-semibold tabular-nums">Predictions</th>
                    <th className="py-2 font-semibold tabular-nums">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={`${row.rank}-${row.displayName}-${row.username ?? ''}`}
                      className="border-b border-zinc-100 break-inside-avoid"
                    >
                      <td className="py-2 pr-3 tabular-nums">{row.rank}</td>
                      <td className="py-2 pr-3">{row.displayName}</td>
                      <td className="py-2 pr-3 text-zinc-600">
                        {row.username || '—'}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{row.totalPoints}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.predictionsMade}
                      </td>
                      <td className="py-2 tabular-nums">
                        {row.correctPredictions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="print:break-before-page"
          aria-labelledby="print-predictions-heading"
        >
          <h2
            id="print-predictions-heading"
            className="mb-3 text-xl font-semibold print:text-lg"
          >
            Prediction results
          </h2>
          {predictions.length === 0 ? (
            <p className="text-sm text-zinc-600">No prediction results yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-300">
                    <th className="py-2 pr-3 font-semibold">Name</th>
                    <th className="py-2 pr-3 font-semibold">Match</th>
                    <th className="py-2 pr-3 font-semibold">Kickoff</th>
                    <th className="py-2 pr-3 font-semibold">Predicted</th>
                    <th className="py-2 pr-3 font-semibold">Actual</th>
                    <th className="py-2 font-semibold tabular-nums">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((row, index) => (
                    <tr
                      key={`${row.displayName}-${row.matchLabel}-${row.kickoffAt ?? ''}-${index}`}
                      className="border-b border-zinc-100 break-inside-avoid"
                    >
                      <td className="py-2 pr-3">{row.displayName}</td>
                      <td className="py-2 pr-3">{row.matchLabel}</td>
                      <td className="py-2 pr-3 text-zinc-600">
                        {row.kickoffAt || '—'}
                      </td>
                      <td className="py-2 pr-3">{row.predicted || '—'}</td>
                      <td className="py-2 pr-3">{row.actualResult || '—'}</td>
                      <td className="py-2 tabular-nums">
                        {row.pointsAwarded ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500 print:mt-6">
          getpoolcup.com · Invite code {meta.inviteCode}
        </footer>
      </main>
    </div>
  )
}
