/**
 * Subtle haptic tick via the Web Vibration API.
 * Supported on many Android browsers; no-ops on iOS Safari / desktop.
 */
export function triggerHaptic(durationMs = 10): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return

  try {
    navigator.vibrate(durationMs)
  } catch {
    // Some environments expose vibrate but throw — ignore.
  }
}
