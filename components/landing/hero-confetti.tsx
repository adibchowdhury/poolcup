'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import './hero-confetti.css'

const CONFETTI_COLORS = [
  '#22c55e',
  'rgba(255, 255, 255, 0.5)',
  'rgba(59, 130, 246, 0.6)',
  'rgba(245, 158, 11, 0.5)',
] as const

const PIECE_COUNT = 40
const MOBILE_VISIBLE_COUNT = 20

const SHAPE_TYPES = ['thin-rect', 'wide-rect', 'square', 'strip'] as const

type ShapeType = (typeof SHAPE_TYPES)[number]

const SHAPE_DIMENSIONS: Record<ShapeType, { width: number; height: number }> = {
  'thin-rect': { width: 3, height: 8 },
  'wide-rect': { width: 8, height: 4 },
  square: { width: 5, height: 5 },
  strip: { width: 2, height: 10 },
}

type ConfettiPiece = {
  left: number
  fallDuration: number
  fallDelay: number
  drift: number
  driftDuration: number
  spinDuration: number
  spinReverse: boolean
  shape: ShapeType
  color: string
}

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function buildConfettiPieces(): ConfettiPiece[] {
  return Array.from({ length: PIECE_COUNT }, (_, index) => ({
    left: seededUnit(index, 2) * 100,
    fallDuration: 3 + seededUnit(index, 3) * 5,
    fallDelay: seededUnit(index, 4) * 5,
    drift: 15 + seededUnit(index, 5) * 15,
    driftDuration: 1.2 + seededUnit(index, 7) * 2.3,
    spinDuration: 0.5 + seededUnit(index, 8) * 1.5,
    spinReverse: seededUnit(index, 9) > 0.5,
    shape: SHAPE_TYPES[index % SHAPE_TYPES.length]!,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length]!,
  }))
}

type HeroConfettiProps = {
  className?: string
}

export function HeroConfetti({ className }: HeroConfettiProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [inView, setInView] = useState(true)
  const pieces = useMemo(() => buildConfettiPieces(), [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const node = rootRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(Boolean(entry?.isIntersecting))
      },
      { threshold: 0.05 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [mounted])

  if (!mounted) return null

  return (
    <div
      ref={rootRef}
      className={cn(
        'hero-confetti pointer-events-none absolute inset-0 z-[1] overflow-hidden',
        !inView && 'hero-confetti--paused',
        className,
      )}
      aria-hidden
    >
      {pieces.map((piece, index) => {
        const { width, height } = SHAPE_DIMENSIONS[piece.shape]

        return (
          <span
            key={index}
            className={cn(
              'hero-confetti-piece',
              index >= MOBILE_VISIBLE_COUNT && 'hidden md:block',
            )}
            style={
              {
                left: `${piece.left}%`,
                animationDuration: `${piece.fallDuration}s`,
                animationDelay: `${piece.fallDelay}s`,
              } as React.CSSProperties
            }
          >
            <span
              className="hero-confetti-drift"
              style={
                {
                  '--drift': `${piece.drift}px`,
                  animationDuration: `${piece.driftDuration}s`,
                  animationDelay: `${piece.fallDelay * 0.4}s`,
                } as React.CSSProperties
              }
            >
              <span
                className="hero-confetti-shape"
                style={
                  {
                    width: `${width}px`,
                    height: `${height}px`,
                    backgroundColor: piece.color,
                    animationDuration: `${piece.spinDuration}s`,
                    animationDelay: `${piece.fallDelay * 0.2}s`,
                    animationDirection: piece.spinReverse ? 'reverse' : 'normal',
                  } as React.CSSProperties
                }
              />
            </span>
          </span>
        )
      })}
    </div>
  )
}
