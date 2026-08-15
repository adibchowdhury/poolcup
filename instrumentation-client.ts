console.log('[ph-debug] instrumentation-client loaded — key present:', !!process.env.NEXT_PUBLIC_POSTHOG_KEY, (process.env.NEXT_PUBLIC_POSTHOG_KEY || '').slice(0, 8))

import posthog from 'posthog-js'

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-01-30',
    // Session replay may be toggled in the PostHog project UI; always mask PII.
    session_recording: {
      maskAllInputs: true,
      maskTextSelector:
        '[data-ph-mask], [data-email], input[type="email"], input[type="password"], input[name*="email" i], input[name*="user" i], input[autocomplete="username"], input[autocomplete="email"]',
    },
  })
}
