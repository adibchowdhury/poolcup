console.log('[ph-debug] instrumentation-client loaded — key present:', !!process.env.NEXT_PUBLIC_POSTHOG_KEY, (process.env.NEXT_PUBLIC_POSTHOG_KEY || '').slice(0, 8))

import posthog from 'posthog-js'

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-01-30',
  })
}
