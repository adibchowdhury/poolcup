import { cache } from 'react'
import { createServerSupabaseClient } from '@/src/lib/supabase/server'

export const getHubAuth = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
})

export const getHubProfile = cache(async (userId: string) => {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('users')
    .select(
      'display_name, username, points, avatar, custom_avatar_url, support_prompt_last_shown_at, created_at, favorite_sports',
    )
    .eq('id', userId)
    .maybeSingle()
  return data
})
