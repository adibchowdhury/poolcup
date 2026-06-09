/** True when Supabase cannot refresh because the stored refresh token is gone/revoked. */
export function isStaleAuthSessionError(error: {
  message?: string
} | null | undefined): boolean {
  if (!error?.message) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found')
  )
}
