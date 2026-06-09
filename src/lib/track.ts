import { supabase } from '@/src/lib/supabase'

export function trackEvent(
  eventName: string,
  opts?: {
    poolId?: string | null
    userId?: string | null
    metadata?: Record<string, any>
  },
): void {
  void (async () => {
    try {
      const { error } = await supabase.from('events').insert({
        event_name: eventName,
        pool_id: opts?.poolId ?? null,
        user_id: opts?.userId ?? null,
        metadata: opts?.metadata ?? {},
      })

      if (error) {
        console.error(`trackEvent(${eventName}) failed:`, error.message)
      }
    } catch (err) {
      console.error(`trackEvent(${eventName}) failed:`, err)
    }
  })()
}
