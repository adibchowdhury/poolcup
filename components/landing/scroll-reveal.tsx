'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return reduced
}

type ScrollRevealGroupProps = {
  children: ReactNode
  className?: string
  /** Intersection threshold (0–1). Default 0.12. */
  threshold?: number
  as?: ElementType
}

/**
 * Observes once when the group enters the viewport, then reveals staggered
 * children marked with `RevealItem` (CSS fade-up). Static when
 * prefers-reduced-motion is set.
 */
export function ScrollRevealGroup({
  children,
  className,
  threshold = 0.12,
  as: Tag = 'div',
}: ScrollRevealGroupProps) {
  const ref = useRef<HTMLElement | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true)
      return
    }

    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -6% 0px',
      },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [reducedMotion, threshold])

  return (
    <Tag
      ref={ref as never}
      className={cn(
        'landing-reveal-group',
        visible && 'is-visible',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

type RevealItemProps = {
  children: ReactNode
  className?: string
  /** Stagger index — delay = index * 75ms. */
  index?: number
  as?: ElementType
}

export function RevealItem({
  children,
  className,
  index = 0,
  as: Tag = 'div',
}: RevealItemProps) {
  return (
    <Tag
      className={cn('landing-reveal-item', className)}
      style={{ '--reveal-i': index } as CSSProperties}
    >
      {children}
    </Tag>
  )
}
