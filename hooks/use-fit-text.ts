'use client'

import { useLayoutEffect, useRef, useState } from 'react'

type UseFitTextOptions = {
  /** Maximum font size in px. */
  maxSize?: number
  /** Minimum font size in px. */
  minSize?: number
  /** Re-run when this changes (e.g. title text). */
  deps?: unknown[]
}

/**
 * Shrinks a single-line element's font-size until it fits its width.
 * Falls back to minSize + browser truncation if still overflowing.
 */
export function useFitText<T extends HTMLElement = HTMLElement>({
  maxSize = 24,
  minSize = 14,
  deps = [],
}: UseFitTextOptions = {}) {
  const ref = useRef<T>(null)
  const [fontSize, setFontSize] = useState(maxSize)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    let size = maxSize
    el.style.fontSize = `${size}px`
    el.style.whiteSpace = 'nowrap'

    while (size > minSize && el.scrollWidth > el.clientWidth) {
      size -= 1
      el.style.fontSize = `${size}px`
    }

    setFontSize(size)
  }, [maxSize, minSize, ...deps])

  return { ref, fontSize }
}
