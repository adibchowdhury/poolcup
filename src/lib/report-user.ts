import type { SupabaseClient } from '@supabase/supabase-js'

export type ReportUserResult =
  | 'ok'
  | 'already_reported'
  | 'self'
  | 'not_authenticated'
  | 'error'

export {
  REPORT_REASON_PRESETS,
  buildAbuseReportReason,
  type ReportReasonPreset,
} from '@/src/lib/abuse-report'

/**
 * Report another user via `report_user(p_reported_user_id, p_reason, p_context)`.
 */
export async function reportUser(
  supabase: SupabaseClient,
  reportedUserId: string,
  reason: string,
  context: string = 'profile',
): Promise<{ result: ReportUserResult; error: string | null }> {
  const trimmed = reason.trim()
  if (!trimmed) {
    return { result: 'error', error: 'Please provide a reason.' }
  }

  const { data, error } = await supabase.rpc('report_user', {
    p_reported_user_id: reportedUserId,
    p_reason: trimmed.slice(0, 500),
    p_context: context,
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('not_authenticated') || msg.includes('jwt')) {
      return { result: 'not_authenticated', error: null }
    }
    console.error('report_user failed:', error.message)
    return { result: 'error', error: error.message }
  }

  const value =
    typeof data === 'string'
      ? data
      : data != null
        ? String(data)
        : 'ok'

  if (value === 'already_reported') {
    return { result: 'already_reported', error: null }
  }
  if (value === 'self') {
    return { result: 'self', error: null }
  }
  if (value === 'not_authenticated') {
    return { result: 'not_authenticated', error: null }
  }
  if (value === 'ok' || value === 'reported' || value === 'success') {
    return { result: 'ok', error: null }
  }

  // Unknown payload — treat as success if no error.
  return { result: 'ok', error: null }
}
