const PENDING_JOIN_INVITE_KEY = 'pending_join_invite'

export function setPendingJoinInvite(inviteCode: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PENDING_JOIN_INVITE_KEY, inviteCode)
}

export function getPendingJoinInvite(): string | null {
  if (typeof window === 'undefined') return null
  const code = localStorage.getItem(PENDING_JOIN_INVITE_KEY)
  if (code) {
    localStorage.removeItem(PENDING_JOIN_INVITE_KEY)
  }
  return code
}
