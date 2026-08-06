import type { SupabaseClient } from '@supabase/supabase-js'

export type MatchEventInfo = {
  id: string
  name: string
  sport: string | null
}

export async function fetchMatchEventInfo(
  supabase: SupabaseClient,
  eventId: string | null | undefined,
): Promise<MatchEventInfo | null> {
  if (!eventId) return null

  const { data, error } = await supabase
    .from('sporting_events')
    .select('id, name, sport')
    .eq('id', eventId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load sporting event:', error.message)
    return null
  }

  if (!data) return null

  return {
    id: data.id as string,
    name: (data.name as string) || 'Competition',
    sport: (data.sport as string | null) ?? null,
  }
}
