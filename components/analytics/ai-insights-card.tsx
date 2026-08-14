'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
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
  generatedAt: string | null
  model: string | null
  insights: InsightItem[]
  feedback: InsightFeedback | null
}

type InsightsApiErr = {
  error?: string
  message?: string
}

/**
 * Pro AI Insights panel for the analytics dashboard.
 * Lazy-loads GET /api/insights on mount; supports regen + feedback.
 */
export function AiInsightsCard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [empty, setEmpty] = useState(false)
  const [insights, setInsights] = useState<InsightItem[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<InsightFeedback | null>(null)
  const [agoLabel, setAgoLabel] = useState<string | null>(null)

  const viewedOnce = useRef(false)

  const applyPayload = useCallback((json: InsightsApiOk) => {
    setEmpty(json.empty === true)
    setInsights(Array.isArray(json.insights) ? json.insights : [])
    setGeneratedAt(json.generatedAt)
    setFeedback(json.feedback)
    setError(null)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insights')
      const json = (await res.json().catch(() => null)) as
        | InsightsApiOk
        | InsightsApiErr
        | null

      if (res.status === 401) {
        setError('Sign in to view insights.')
        return
      }
      if (res.status === 403) {
        setError('Pro required to view insights.')
        return
      }
      if (!res.ok || !json || !('isPro' in json)) {
        setError(
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
      setError('Could not load insights.')
    } finally {
      setLoading(false)
    }
  }, [applyPayload])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!generatedAt) {
      setAgoLabel(null)
      return
    }
    const tick = () => setAgoLabel(formatGeneratedAgo(generatedAt))
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [generatedAt])

  async function handleRegenerate() {
    if (regenerating || loading) return
    setRegenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/insights', { method: 'POST' })
      const json = (await res.json().catch(() => null)) as
        | InsightsApiOk
        | InsightsApiErr
        | null

      if (res.status === 429) {
        setError(
          (json && 'message' in json && json.message) ||
            "You've regenerated your insights a few times today. Try again tomorrow.",
        )
        return
      }
      if (!res.ok || !json || !('isPro' in json)) {
        setError(
          (json && 'message' in json && json.message) ||
            'Could not regenerate insights.',
        )
        return
      }

      applyPayload(json)
      capturePostHog('insights_regenerated', {
        empty: json.empty === true,
        insight_count: json.insights?.length ?? 0,
      })
    } catch {
      setError('Could not regenerate insights.')
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
        setError(json?.message || 'Could not save feedback.')
        return
      }
      setFeedback(next)
      capturePostHog('insights_feedback_given', { feedback: next })
    } catch {
      setError('Could not save feedback.')
    } finally {
      setFeedbackBusy(false)
    }
  }

  const busy = loading || regenerating

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
            Personalized tips from your prediction stats — Claude Haiku, on demand.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn('h-9 shrink-0', FOCUS_VISIBLE_RING)}
          disabled={busy || empty}
          onClick={() => void handleRegenerate()}
        >
          {regenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          )}
          Regenerate
        </Button>
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

      {!loading && error ? (
        <div className="mt-4 space-y-3" role="alert">
          <p className="text-sm text-destructive">{error}</p>
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

      {!loading && !error && empty ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          Make some predictions to unlock insights
        </p>
      ) : null}

      {!loading && !error && !empty && insights.length > 0 ? (
        <>
          {agoLabel ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Generated {agoLabel}
            </p>
          ) : null}

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
