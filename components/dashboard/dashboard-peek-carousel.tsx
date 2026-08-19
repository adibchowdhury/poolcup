'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'

const DEFAULT_VISIBLE_CARDS = 3
const DEFAULT_PEEK_FRACTION = 0.2
const DEFAULT_GAP_PX = 12

export const DASHBOARD_PEEK_CAROUSEL_SCROLL_CLASS = cn(
  '@container min-w-0 max-w-full overflow-x-auto overscroll-x-contain scroll-smooth',
  'scrollbar-hidden [-webkit-overflow-scrolling:touch]',
)

export const DASHBOARD_PEEK_CAROUSEL_TRACK_CLASS = 'flex min-w-0'

type UseDashboardPeekCarouselOptions = {
  visibleCards?: number
  peekFraction?: number
  gapPx?: number
}

export function useDashboardPeekCarousel({
  visibleCards = DEFAULT_VISIBLE_CARDS,
  peekFraction = DEFAULT_PEEK_FRACTION,
  gapPx = DEFAULT_GAP_PX,
}: UseDashboardPeekCarouselOptions = {}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [cardWidthPx, setCardWidthPx] = useState<number | null>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollPrev(el.scrollLeft > 1)
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  const recomputeCardWidth = useCallback(() => {
    const el = scrollRef.current
    if (!el || !isDesktop) {
      setCardWidthPx(null)
      return
    }

    const cardW =
      (el.clientWidth - visibleCards * gapPx) / (visibleCards + peekFraction)
    setCardWidthPx(Math.max(0, cardW))
  }, [gapPx, isDesktop, peekFraction, visibleCards])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      recomputeCardWidth()
      updateScrollState()
    })

    observer.observe(el)
    recomputeCardWidth()
    updateScrollState()

    return () => observer.disconnect()
  }, [recomputeCardWidth, updateScrollState])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    el.addEventListener('scroll', updateScrollState, { passive: true })
    return () => el.removeEventListener('scroll', updateScrollState)
  }, [updateScrollState])

  const scrollByOne = useCallback(
    (direction: 1 | -1) => {
      const el = scrollRef.current
      if (!el || cardWidthPx == null) return
      el.scrollBy({
        left: direction * (cardWidthPx + gapPx),
        behavior: 'smooth',
      })
    },
    [cardWidthPx, gapPx],
  )

  const scrollStyle: CSSProperties | undefined =
    cardWidthPx != null
      ? ({ '--peek-card-width': `${cardWidthPx}px` } as CSSProperties)
      : undefined

  return {
    scrollRef,
    scrollStyle,
    cardWidthPx,
    canScrollPrev,
    canScrollNext,
    scrollPrev: () => scrollByOne(-1),
    scrollNext: () => scrollByOne(1),
    isDesktop,
  }
}

type DashboardPeekCarouselNavProps = {
  canScrollPrev: boolean
  canScrollNext: boolean
  onPrev: () => void
  onNext: () => void
  className?: string
}

export function DashboardPeekCarouselNav({
  canScrollPrev,
  canScrollNext,
  onPrev,
  onNext,
  className,
}: DashboardPeekCarouselNavProps) {
  return (
    <div
      className={cn('hidden shrink-0 items-center gap-0.5 lg:flex', className)}
      aria-label="Carousel navigation"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
        disabled={!canScrollPrev}
        onClick={onPrev}
        aria-label="Scroll picks left"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
        disabled={!canScrollNext}
        onClick={onNext}
        aria-label="Scroll picks right"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}

export function dashboardPeekCarouselItemClass(mobileItemClass: string): string {
  return cn(
    mobileItemClass,
    'lg:w-[var(--peek-card-width)] lg:max-w-none',
  )
}

export type DashboardPeekCarouselScrollProps = {
  scrollRef: RefObject<HTMLDivElement | null>
  scrollStyle?: CSSProperties
  className?: string
  trackClassName?: string
  ariaLabel: string
  children: ReactNode
}

export function DashboardPeekCarouselScroll({
  scrollRef,
  scrollStyle,
  className,
  trackClassName,
  ariaLabel,
  children,
}: DashboardPeekCarouselScrollProps) {
  return (
    <div
      ref={scrollRef}
      style={scrollStyle}
      className={cn(DASHBOARD_PEEK_CAROUSEL_SCROLL_CLASS, className)}
      role="list"
      aria-label={ariaLabel}
    >
      <div className={cn(DASHBOARD_PEEK_CAROUSEL_TRACK_CLASS, trackClassName)}>
        {children}
      </div>
    </div>
  )
}
