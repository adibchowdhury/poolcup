/** sessionStorage handoff: desktop /create bounce → dashboard opens modal. */

export const CREATE_POOL_MODAL_HANDOFF_KEY = 'poolcup_create_modal_handoff'

export type CreatePoolModalHandoff = {
  /** Stripe return flags from /create?checkout=… */
  checkout?: 'success' | 'cancel' | null
  draftId?: string | null
}

export function setCreatePoolModalHandoff(
  handoff: CreatePoolModalHandoff,
): void {
  try {
    sessionStorage.setItem(
      CREATE_POOL_MODAL_HANDOFF_KEY,
      JSON.stringify(handoff),
    )
  } catch {
    // private mode / quota
  }
}

export function consumeCreatePoolModalHandoff(): CreatePoolModalHandoff | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CREATE_POOL_MODAL_HANDOFF_KEY)
    sessionStorage.removeItem(CREATE_POOL_MODAL_HANDOFF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CreatePoolModalHandoff
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** Click-time desktop gate — not used for render trees (hydration-safe). */
export function isCreatePoolDesktopModalViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 1024px)').matches
}
