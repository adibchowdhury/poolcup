'use client'

import { useEffect, useState } from 'react'

function isFormControl(element: Element | null): boolean {
  return (
    element instanceof HTMLElement &&
    element.matches('input, textarea, select, [contenteditable="true"]')
  )
}

/** True while a text input on the page has focus (mobile keyboard open). */
export function useMobileInputFocused() {
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (isFormControl(event.target as Element)) {
        setFocused(true)
      }
    }

    const onFocusOut = () => {
      requestAnimationFrame(() => {
        if (!isFormControl(document.activeElement)) {
          setFocused(false)
        }
      })
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return focused
}
