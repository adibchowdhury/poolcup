/** iOS often skips :active unless a pointer listener sets [data-pressed]. */
export function bindTactilePress(target: EventTarget | null) {
  const btn =
    target instanceof Element
      ? target.closest('.ui-tactile-btn')
      : null
  if (!btn || (btn instanceof HTMLButtonElement && btn.disabled)) return
  if (btn.hasAttribute('data-pressed')) return
  btn.setAttribute('data-pressed', '')
  const clear = () => {
    btn.removeAttribute('data-pressed')
    window.removeEventListener('pointerup', clear)
    window.removeEventListener('pointercancel', clear)
  }
  window.addEventListener('pointerup', clear)
  window.removeEventListener('pointercancel', clear)
}
