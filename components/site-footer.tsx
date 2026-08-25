'use client'

import Link from 'next/link'
import { Trophy } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

type FooterLink =
  | { label: string; href: string; external?: boolean }
  | { label: string; hash: string }

const siteMap: FooterLink[] = [
  { label: 'How it works', hash: '#how-it-works' },
  { label: 'Features', hash: '#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact Support', href: '/contact' },
  { label: 'Sign in', href: '/login' },
]

const legal: { label: string; href: string }[] = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Refunds', href: '/terms#payments-refunds' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'How We Protect Your Data', href: '/security' },
]

const REDDIT_COMMUNITY_URL = 'https://www.reddit.com/r/PoolCupCommunity/'

const linkClassName =
  'font-sans text-sm text-[#5a7080] transition-colors hover:text-primary'

function FooterLinkItem({ item }: { item: FooterLink }) {
  if ('hash' in item) {
    return (
      <a href={item.hash} className={linkClassName}>
        {item.label}
      </a>
    )
  }

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        {item.label}
      </a>
    )
  }

  return (
    <Link href={item.href} className={linkClassName}>
      {item.label}
    </Link>
  )
}

/** Official-style Reddit mark (Simple Icons path), sized for inline button use. */
function RedditMarkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.028l2.907.617a1.214 1.214 0 0 1 1.108-.701zM9.607 12c-.534 0-.969.434-.969.969 0 .535.435.969.969.969.535 0 .969-.434.969-.969 0-.535-.434-.969-.969-.969zm4.786 0c-.535 0-.969.434-.969.969 0 .535.434.969.969.969.534 0 .969-.434.969-.969 0-.535-.435-.969-.969-.969zm-4.786 2.378a.715.715 0 0 0 0 1.428c.957 0 1.843.34 2.536.907a.715.715 0 0 0 .995 0c.693-.567 1.579-.907 2.536-.907a.715.715 0 0 0 0-1.428c-1.254 0-2.397.465-3.286 1.21-.889-.745-2.032-1.21-3.286-1.21z" />
    </svg>
  )
}

/**
 * Dedicated Community column (lg+) / stacked block (mobile).
 * Future member-count line would sit between benefit copy and the CTA.
 */
function CommunityColumnBlock() {
  return (
    <div>
      <h3 className="font-display text-2xl tracking-wide text-[#f0f4f8]">
        Join the PoolCup Community
      </h3>
      <p className="mt-3 max-w-sm font-sans text-sm leading-relaxed text-[#5a7080]">
        Talk predictions, share pools, suggest features, and help shape what we
        build next.
      </p>
      {/* Future: member-count line here, e.g. "X,XXX members" */}
      <a
        href={REDDIT_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex max-w-full items-center justify-center gap-2.5 rounded-lg bg-[#FF4500] px-4 py-3.5 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#E03E00]"
      >
        <RedditMarkIcon className="shrink-0" />
        <span className="whitespace-nowrap">Join us on Reddit →</span>
      </a>
    </div>
  )
}

type SiteFooterProps = {
  backgroundClass?: string
}

export function SiteFooter({ backgroundClass = 'bg-background' }: SiteFooterProps) {
  const year = new Date().getFullYear()

  const scrollToTop = () => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className={`${backgroundClass} font-sans text-[#f0f4f8]`}>
      <div className="border-t border-[rgba(255,255,255,0.08)] bg-background">
        {/*
          Mobile: single column stack.
          lg+: four columns — brand | community (slightly wider) | site map | legal.
        */}
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:py-16 lg:grid-cols-[1.15fr_1.4fr_1fr_1fr] lg:gap-10">
          {/* 1 — Brand */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
                <Trophy className="h-5 w-5 text-primary" />
              </span>
              <span className="font-display text-2xl tracking-wider text-primary">
                POOLCUP
              </span>
            </Link>
            <p className="mt-5 max-w-sm font-sans text-sm leading-relaxed text-[#5a7080]">
              Prediction pools for every season — Premier League, NFL, NBA, MLB,
              NHL, and more. Free to play with friends, year-round.
            </p>
          </div>

          {/* 2 — Community */}
          <div>
            <CommunityColumnBlock />
          </div>

          {/* Mobile accordion */}
          <div className="lg:hidden">
            <Accordion type="multiple" className="w-full">
              <AccordionItem
                value="site-map"
                className="border-[rgba(255,255,255,0.08)]"
              >
                <AccordionTrigger className="font-footer-heading py-3 text-[#f0f4f8] hover:no-underline [&>svg]:text-[#5a7080]">
                  Site Map
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-3">
                    {siteMap.map((item) => (
                      <li key={item.label}>
                        <FooterLinkItem item={item} />
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="legal"
                className="border-[rgba(255,255,255,0.08)]"
              >
                <AccordionTrigger className="font-footer-heading py-3 text-[#f0f4f8] hover:no-underline [&>svg]:text-[#5a7080]">
                  Legal &amp; Privacy
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-3">
                    {legal.map((item) => (
                      <li key={item.label}>
                        <Link href={item.href} className={linkClassName}>
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* 3 — Site Map (desktop) */}
          <div className="hidden lg:block">
            <h3 className="font-footer-heading text-[#f0f4f8]">Site Map</h3>
            <ul className="mt-5 space-y-3">
              {siteMap.map((item) => (
                <li key={item.label}>
                  <FooterLinkItem item={item} />
                </li>
              ))}
            </ul>
          </div>

          {/* 4 — Legal (desktop) */}
          <div className="hidden lg:block">
            <h3 className="font-footer-heading text-[#f0f4f8]">
              Legal &amp; Privacy
            </h3>
            <ul className="mt-5 space-y-3">
              {legal.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className={linkClassName}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Quiet bar: copyright + demoted Back to top text link */}
      <div className="relative bg-primary px-5 py-3 font-sans text-xs font-medium text-primary-foreground">
        <p className="text-center">
          Copyright © {year} PoolCup. All rights reserved.
        </p>
        <button
          type="button"
          onClick={scrollToTop}
          className="mx-auto mt-1.5 block text-[11px] font-normal text-primary-foreground/70 underline-offset-2 transition-colors hover:text-primary-foreground hover:underline lg:absolute lg:right-5 lg:top-1/2 lg:mt-0 lg:-translate-y-1/2"
        >
          Back to top
        </button>
      </div>
    </footer>
  )
}
