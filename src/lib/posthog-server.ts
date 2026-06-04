import { PostHog } from 'posthog-node'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

let posthogServer: PostHog | null = null

export function getPostHogServer(): PostHog | null {
  if (!POSTHOG_KEY) return null

  if (!posthogServer) {
    posthogServer = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
    })
  }

  return posthogServer
}
