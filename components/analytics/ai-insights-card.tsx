'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ShimmerBlock } from '@/components/ui/shimmer-block'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { capturePostHog } from '@/src/lib/posthog-client'
import {
  formatGeneratedAgo,
  type InsightFeedback,
  type InsightItem,
} from '@/src/lib/ai-insights-shared'

type InsightsApiOk = {
  isPro: true
  empty: boolean
  cached: boolean
  generatedAt?: string | null
  /** Tolerate snake_case if ever returned. */
  generated_at?: string | null
  model: string | null
  insights: InsightItem[]
  feedback: InsightFeedback | null
}

type InsightsApiErr = {
  error?: string
  message?: string
}

function readGeneratedAt(json: InsightsApiOk): string | null {
  const raw = json.generatedAt ?? json.generated_at ?? null
  if (typeof raw !== 'string' || !raw.trim()) return null
  const t = new Date(raw).getTime()
  if (!Number.isFinite(t)) return null
  return raw
}

/**
 * Pro AI Insights panel for the analytics dashboard.
 * Lazy-loads GET /api/insights on mount; supports regen + feedback.
 *
 * Failed / rate-limited regenerate must never clear already-shown insights.
 */
export function AiInsightsCard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  /** Fatal load error (no insights to show). */
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Non-destructive notice (regen 429 / regen failure) — insights stay. */
  const [notice, setNotice] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [insights, setInsights] = useState<InsightItem[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<InsightFeedback | null>(null)
  /** Bumps so relative "Generated X ago" refreshes every minute. */
  const [agoTick, setAgoTick] = useState(0)

  const viewedOnce = useRef(false)

  const applyPayload = useCallback((json: InsightsApiOk) => {
    setEmpty(json.empty === true)
    setInsights(Array.isArray(json.insights) ? json.insights : [])
    setGeneratedAt(readGeneratedAt(json))
    setFeedback(json.feedback)
    setLoadError(null)
    setNotice(null)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/insights')
      const json = (await res.json().catch(() => null)) as
        | InsightsApiOk
        | InsightsApiErr
        | null

      if (res.status === 401) {
        setLoadError('Sign in to view insights.')
        return
      }
      if (res.status === 403) {
        setLoadError('Pro required to view insights.')
        return
      }
      if (!res.ok || !json || !('isPro' in json)) {
        setLoadError(
          (json && 'message' in json && json.message) ||
            'Could not load insights.',
        )
        return
      }

      applyPayload(json)
      if (!viewedOnce.current) {
        viewedOnce.current = true
        capturePostHog('insights_viewed', {
          empty: json.empty === true,
          cached: json.cached === true,
          insight_count: json.insights?.length ?? 0,
        })
      }
    } catch {
      setLoadError('Could not load insights.')
    } finally {
      setLoading(false)
    }
  }, [applyPayload])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!generatedAt) return
    const id = window.setInterval(() => setAgoTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [generatedAt])

  async function handleRegenerate() {
    if (regenerating || loading || rateLimited) return
    setRegenerating(true)
    setNotice(null)
    try {
      const res = await fetch('/api/insights', { method: 'POST' })
      const json = (await res.json().catch(() => null)) as
        | InsightsApiOk
        | InsightsApiErr
        | null

      if (res.status === 429) {
        const message =
          (json && 'message' in json && json.message) ||
          "You've regenerated your insights a few times today. Try again tomorrow."
        // Keep existing insights — notice only.
        setRateLimited(true)
        setNotice(message)
        toast.message(message)
        return
      }
      if (!res.ok || !json || !('isPro' in json)) {
        const message =
          (json && 'message' in json && json.message) ||
          'Could not regenerate insights. Please try again.'
        setNotice(message)
        toast.error(message)
        return
      }

      applyPayload(json)
      setRateLimited(false)
      capturePostHog('insights_regenerated', {
        empty: json.empty === true,
        insight_count: json.insights?.length ?? 0,
      })
    } catch {
      const message = 'Could not regenerate insights. Please try again.'
      setNotice(message)
      toast.error(message)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleFeedback(next: InsightFeedback) {
    if (feedbackBusy || empty || insights.length === 0) return
    setFeedbackBusy(true)
    try {
      const res = await fetch('/api/insights/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: next }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as InsightsApiErr | null
        const message = json?.message || 'Could not save feedback.'
        setNotice(message)
        toast.error(message)
        return
      }
      setFeedback(next)
      capturePostHog('insights_feedback_given', { feedback: next })
    } catch {
      const message = 'Could not save feedback.'
      setNotice(message)
      toast.error(message)
    } finally {
      setFeedbackBusy(false)
    }
  }

  const busy = loading || regenerating
  const hasInsights = !empty && insights.length > 0
  const agoLabel = generatedAt ? formatGeneratedAgo(generatedAt) : null

  return (
    <section
      className={cn(
        'rounded-xl border border-primary/20 bg-gradient-to-b from-primary/10 to-card/40 p-4 sm:p-5',
        className,
      )}
      aria-labelledby="ai-insights-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="ai-insights-heading"
            className="flex items-center gap-2 font-display text-xl tracking-wide text-foreground"
          >
            <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            AI Insights
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generated by Anthropic Claude from your own aggregated prediction
            stats. Informational and for entertainment — not betting, gambling,
            or financial advice.{' '}
            <Link
              href="/terms#ai-insights"
              className="text-primary underline-offset-4 hover:underline"
            >
              Learn more
            </Link>
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-stretch gap-1 sm:items-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn('h-9 shrink-0', FOCUS_VISIBLE_RING)}
            disabled={busy || empty || rateLimited}
            aria-disabled={busy || empty || rateLimited}
            onClick={() => void handleRegenerate()}
          >
            {regenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            )}
            {rateLimited ? 'Limit reached' : 'Regenerate'}
          </Button>
          {notice ? (
            <p
              className="max-w-[16rem] text-right text-[11px] text-muted-foreground"
              role="status"
            >
              {notice}
            </p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3" aria-busy="true" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Generating your insights…
          </p>
          <ShimmerBlock className="h-16 w-full rounded-lg" />
          <ShimmerBlock className="h-16 w-full rounded-lg" />
          <ShimmerBlock className="h-16 w-full rounded-lg" />
          <ShimmerBlock className="h-16 w-3/4 rounded-lg" />
        </div>
      ) : null}

      {!loading && loadError && !hasInsights ? (
        <div className="mt-4 space-y-3" role="alert">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={FOCUS_VISIBLE_RING}
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !loadError && empty ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          Make some predictions to unlock insights
        </p>
      ) : null}

      {!loading && hasInsights ? (
        <>
          <p
            className="mt-3 text-xs text-muted-foreground"
            key={`ago-${agoTick}-${generatedAt ?? 'none'}`}
          >
            {agoLabel ? `Generated ${agoLabel}` : 'Generated recently'}
          </p>

          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {insights.map((item) => (
              <li
                key={`${item.type}-${item.title}`}
                className="rounded-lg border border-border/70 bg-background/50 p-3 text-left"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {insightTypeLabel(item.type)}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>

          <div
            className="mt-4 flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Was this useful?"
          >
            <span className="text-xs text-muted-foreground">Was this useful?</span>
            <Button
              type="button"
              size="sm"
              variant={feedback === 'useful' ? 'default' : 'outline'}
              className={cn('h-8', FOCUS_VISIBLE_RING)}
              disabled={feedbackBusy}
              aria-pressed={feedback === 'useful'}
              onClick={() => void handleFeedback('useful')}
            >
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Useful
            </Button>
            <Button
              type="button"
              size="sm"
              variant={feedback === 'not_useful' ? 'default' : 'outline'}
              className={cn('h-8', FOCUS_VISIBLE_RING)}
              disabled={feedbackBusy}
              aria-pressed={feedback === 'not_useful'}
              onClick={() => void handleFeedback('not_useful')}
            >
              <ThumbsDown className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Not useful
            </Button>
          </div>
        </>
      ) : null}
    </section>
  )
}

function insightTypeLabel(type: InsightItem['type']): string {
  switch (type) {
    case 'weekly_summary':
      return 'Weekly summary'
    case 'strongest_sport':
      return 'Strongest sport'
    case 'weakest_area':
      return 'Weakest area'
    case 'recent_form':
      return 'Recent form'
    default:
      return type
  }
}
