import posthog from 'posthog-js'

export function identifyPostHogUser(
  userId: string,
  traits?: { email?: string | null },
): void {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return
  }

  posthog.identify(
    userId,
    traits?.email ? { email: traits.email } : undefined,
  )
}

export function resetPostHog(): void {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return
  }

  posthog.reset()
}

export function capturePostHog(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return
  }

  posthog.capture(event, properties)
}

export function poolCreatedMode(
  scoringStyle: string,
): 'winner_only' | 'score_predictor' {
  return scoringStyle === 'winner' ? 'winner_only' : 'score_predictor'
}
