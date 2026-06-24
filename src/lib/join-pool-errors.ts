import type { PostgrestError } from '@supabase/supabase-js'

/** User-safe join errors — never surface raw RLS/Postgres messages. */
export function getJoinPoolErrorMessage(error: PostgrestError): string {
  const message = error.message?.toLowerCase() ?? ''
  const code = error.code ?? ''

  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('violates row-level security') ||
    message.includes('permission denied')
  ) {
    return 'This pool just closed to new members.'
  }

  if (
    code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('unique constraint')
  ) {
    return 'You are already in this pool.'
  }

  return 'Unable to join this pool. Please try again.'
}
