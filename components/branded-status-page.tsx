'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type BrandedStatusPageProps = {
  code?: string
  title: string
  description: string
  primaryHref?: string
  primaryLabel?: string
  onPrimaryAction?: () => void
  primaryActionLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
  className?: string
}

/**
 * Shared on-brand full-page status shell for 404 / route errors / fatal errors.
 * Avoids auth-aware logo so it works inside global-error (no providers).
 */
export function BrandedStatusPage({
  code,
  title,
  description,
  primaryHref = '/',
  primaryLabel = 'Go home',
  onPrimaryAction,
  primaryActionLabel = 'Try again',
  secondaryHref,
  secondaryLabel,
  className,
}: BrandedStatusPageProps) {
  return (
    <main
      className={cn(
        'relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-16 text-foreground',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,230,118,0.14),transparent_55%),radial-gradient(ellipse_at_80%_100%,rgba(255,179,0,0.06),transparent_45%)]"
      />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <Link
          href="/"
          className="mb-8 inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="PoolCup home"
        >
          <Image
            src="/poolcup-logo.png"
            alt="PoolCup"
            width={140}
            height={48}
            className="h-10 w-auto object-contain sm:h-12"
            priority
          />
        </Link>

        {code ? (
          <p className="font-display text-6xl tracking-wide text-primary/90 sm:text-7xl">
            {code}
          </p>
        ) : null}

        <h1
          className={cn(
            'font-display tracking-wide text-foreground',
            code ? 'mt-3 text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl',
          )}
        >
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          {onPrimaryAction ? (
            <Button
              type="button"
              onClick={onPrimaryAction}
              className="min-h-11 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {primaryActionLabel}
            </Button>
          ) : null}
          <Button
            asChild
            variant={onPrimaryAction ? 'outline' : 'default'}
            className="min-h-11 focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
          {secondaryHref && secondaryLabel ? (
            <Button
              asChild
              variant="ghost"
              className="min-h-11 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  )
}
