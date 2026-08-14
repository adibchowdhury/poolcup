/**
 * Shared abuse-report reason categories (user / message / pool).
 */

export const REPORT_REASON_PRESETS = [
  'Harassment or bullying',
  'Spam',
  'Hate speech',
  'Inappropriate content',
  'Impersonation',
  'Other',
] as const

export type ReportReasonPreset = (typeof REPORT_REASON_PRESETS)[number]

/** Build the stored `reason` string from preset + optional free-text details. */
export function buildAbuseReportReason(
  preset: string,
  details: string,
): string | null {
  const trimmedDetails = details.trim()
  if (preset === 'Other') {
    return trimmedDetails || null
  }
  if (trimmedDetails) {
    return `${preset}: ${trimmedDetails}`.slice(0, 500)
  }
  return preset.trim() || null
}
