import type {
  GlobalActivityFeedResult,
  GlobalActivityItem,
  GlobalActivityItemType,
} from '@/src/lib/global-activity-feed-core'

export type {
  GlobalActivityItem,
  GlobalActivityItemType,
}

export type GlobalActivityFeedData = GlobalActivityFeedResult & {
  error: string | null
}

const empty: GlobalActivityFeedData = {
  items: [],
  isSparse: false,
  isEmpty: true,
  error: null,
}

export async function fetchGlobalActivityFeed(
  _userId: string,
  options?: { scope?: 'dashboard' | 'page' },
): Promise<GlobalActivityFeedData> {
  try {
    const scope = options?.scope === 'page' ? 'page' : 'dashboard'
    const res = await fetch(`/api/dashboard/global-activity?scope=${scope}`, {
      credentials: 'include',
    })

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      return {
        ...empty,
        error: body?.error ?? `Request failed (${res.status})`,
      }
    }

    const data = (await res.json()) as GlobalActivityFeedResult
    return { ...data, error: null }
  } catch (err) {
    return {
      ...empty,
      error:
        err instanceof Error
          ? err.message
          : 'Failed to load global PoolCup activity',
    }
  }
}
