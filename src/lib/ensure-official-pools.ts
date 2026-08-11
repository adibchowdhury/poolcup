import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Best-effort: create missing official pools for live/upcoming sporting_events.
 * Never throws — must not break fixture/score ingestion.
 */
export async function ensureOfficialPoolsBestEffort(
  supabase: SupabaseClient,
  source: string,
): Promise<{ created: number | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('ensure_official_pools')
    if (error) {
      console.error(`[${source}] ensure_official_pools failed:`, error.message)
      return { created: null, error: error.message }
    }

    const created =
      typeof data === 'number' && Number.isFinite(data)
        ? Math.max(0, Math.floor(data))
        : data == null
          ? 0
          : Number.isFinite(Number(data))
            ? Math.max(0, Math.floor(Number(data)))
            : null

    console.info(
      `[${source}] ensure_official_pools: created=${created ?? 'unknown'}`,
      { raw: data },
    )
    return { created, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[${source}] ensure_official_pools threw:`, message)
    return { created: null, error: message }
  }
}
