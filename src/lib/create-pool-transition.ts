type RouterPush = { push: (href: string) => void }

/** sessionStorage key coordinating dashboard ↔ /create handoff (mobile only). */
export const CREATE_POOL_TRANSITION_KEY = 'poolcup_create_transition'

export type CreatePoolTransitionKind = 'enter' | 'exit'

/** Gentle ease-out used by create-mode CSS animations. */
export const CREATE_POOL_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** Button press dwell before dashboard starts receding. */
export const CREATE_POOL_PRESS_MS = 100

/** Create screen exit duration before router.push('/dashboard'). */
export const CREATE_POOL_SCREEN_EXIT_MS = 240

export function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** @deprecated Use isCreatePoolDesktopModalViewport from create-pool-modal-handoff. */
export function isCreatePoolDesktopInShell(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 1024px)').matches
}

export function setCreatePoolTransition(kind: CreatePoolTransitionKind): void {
  try {
    sessionStorage.setItem(CREATE_POOL_TRANSITION_KEY, kind)
  } catch {
    // private mode / quota — navigation still works without the flag
  }
}

export function consumeCreatePoolTransition(): CreatePoolTransitionKind | null {
  if (typeof window === 'undefined') return null
  try {
    const value = sessionStorage.getItem(CREATE_POOL_TRANSITION_KEY)
    sessionStorage.removeItem(CREATE_POOL_TRANSITION_KEY)
    if (value === 'enter' || value === 'exit') return value
  } catch {
    return null
  }
  return null
}

export function clearCreateModeDashboardExitClass(): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove('create-mode-dashboard-exit')
}

type BeginCreatePoolEntryOptions = {
  /** Desktop: open hub modal instead of navigating. */
  openModal?: () => void
}

/**
 * Create Pool entry: desktop opens the hub modal (no navigation);
 * mobile keeps the full-screen /create choreography.
 * Viewport is read at click time (not during render).
 */
export function beginCreatePoolEntry(
  router: RouterPush,
  options?: BeginCreatePoolEntryOptions,
): void {
  if (options?.openModal && isCreatePoolDesktopInShell()) {
    clearCreateModeDashboardExitClass()
    options.openModal()
    return
  }

  if (readPrefersReducedMotion()) {
    clearCreateModeDashboardExitClass()
    router.push('/create')
    return
  }
  setCreatePoolTransition('enter')
  document.documentElement.classList.add('create-mode-dashboard-exit')
  window.setTimeout(() => {
    router.push('/create')
  }, 200)
}

/**
 * Full click choreography: transient press scale, then entry.
 */
export function startCreatePoolEntryFromClick(
  router: RouterPush,
  button: HTMLElement | null,
  options?: BeginCreatePoolEntryOptions,
): void {
  if (options?.openModal && isCreatePoolDesktopInShell()) {
    clearCreateModeDashboardExitClass()
    options.openModal()
    return
  }

  if (readPrefersReducedMotion()) {
    clearCreateModeDashboardExitClass()
    router.push('/create')
    return
  }

  if (button) {
    button.classList.add('create-pool-entry-pressed')
  }

  window.setTimeout(() => {
    if (button) {
      button.classList.remove('create-pool-entry-pressed')
    }
    beginCreatePoolEntry(router, options)
  }, CREATE_POOL_PRESS_MS)
}

/**
 * /create → dashboard (mobile page exit choreography).
 * Modal close should call the modal context closer instead.
 */
export function beginCreatePoolExit(
  router: RouterPush,
  onStart?: () => void,
): void {
  if (readPrefersReducedMotion() || isCreatePoolDesktopInShell()) {
    router.push('/dashboard')
    return
  }
  setCreatePoolTransition('exit')
  onStart?.()
  window.setTimeout(() => {
    router.push('/dashboard')
  }, CREATE_POOL_SCREEN_EXIT_MS)
}
