/** Fallback when pool.event_id is missing or sporting_events.name is unavailable. */
export const POOL_EVENT_NAME_FALLBACK = 'Competition'

export function buildEventNameById(
  rows: Array<{ id: string; name: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    const name = row.name?.trim()
    if (name) map.set(row.id, name)
  }
  return map
}

/**
 * Resolve a pool's competition label strictly from event_id → sporting_events.name.
 * Never use denormalized pools.event_name.
 */
export function resolvePoolEventName(
  eventId: string | null | undefined,
  eventNameById: Map<string, string>,
  fallback = POOL_EVENT_NAME_FALLBACK,
): string {
  const trimmed = eventId?.trim()
  if (!trimmed) return fallback
  return eventNameById.get(trimmed)?.trim() || fallback
}

/**
 * Load sporting_events.name for a set of event ids (single query).
 */
export async function fetchEventNameById(
  supabase: {
    from: (
      table: string,
    ) => {
      select: (columns: string) => {
        in: (
          column: string,
          values: string[],
        ) => PromiseLike<{
          data: Array<{ id: string; name: string | null }> | null
          error: { message: string } | null
        }>
      }
    }
  },
  eventIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(eventIds.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const { data, error } = await supabase
    .from('sporting_events')
    .select('id, name')
    .in('id', unique)

  if (error) {
    throw new Error(error.message)
  }

  return buildEventNameById(data ?? [])
}
