'use client'

import type { KeyboardEvent } from 'react'

/**
 * Roving-tabindex arrow/Home/End navigation for role="tablist" buttons.
 * Enter/Space are handled by native <button> activation.
 */
export function handleRovingTabKeyDown<T extends string>(
  event: KeyboardEvent,
  options: {
    tabs: readonly T[]
    activeId: T
    onChange: (id: T) => void
    tablist: HTMLElement | null
  },
): void {
  const { tabs, activeId, onChange, tablist } = options
  if (tabs.length === 0) return

  const index = tabs.indexOf(activeId)
  if (index < 0) return

  let nextIndex = index
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault()
      nextIndex = (index + 1) % tabs.length
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault()
      nextIndex = (index - 1 + tabs.length) % tabs.length
      break
    case 'Home':
      event.preventDefault()
      nextIndex = 0
      break
    case 'End':
      event.preventDefault()
      nextIndex = tabs.length - 1
      break
    default:
      return
  }

  const nextId = tabs[nextIndex]
  if (!nextId || nextId === activeId) {
    focusTabInList(tablist, nextId ?? activeId)
    return
  }

  onChange(nextId)
  requestAnimationFrame(() => {
    focusTabInList(tablist, nextId)
  })
}

function focusTabInList(tablist: HTMLElement | null, id: string): void {
  const el = tablist?.querySelector<HTMLElement>(
    `[role="tab"][data-tab-id="${CSS.escape(id)}"]`,
  )
  el?.focus()
}
