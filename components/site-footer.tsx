'use client'

import Link from 'next/link'
import { Trophy } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { DiscordMarkIcon } from '@/components/discord-mark-icon'
import {
  DISCORD_BLURPLE,
  DISCORD_BLURPLE_HOVER,
  DISCORD_INVITE_URL,
} from '@/src/lib/discord-invite'

type FooterLink =
  | { label: string; href: string; external?: boolean }
  | { label: string; hash: string }

const siteMap: FooterLink[] = [
  { label: 'How it works', hash: '#how-it-works' },
  { label: 'Features', hash: '#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: "NFL Pick'em", href: '/nfl-pick-em' },
  { label: "College Football Pick'em", href: '/college-football-pick-em' },
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
        Talk predictions, get live match alerts from Pucky, suggest features,
        and help shape what we build next.
      </p>
      {/* Future: member-count line here, e.g. "X,XXX members" */}
      <a
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex max-w-full items-center justify-center gap-2.5 rounded-lg px-4 py-3.5 font-sans text-sm font-semibold text-white transition-colors hover:opacity-90"
        style={{ backgroundColor: DISCORD_BLURPLE }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = DISCORD_BLURPLE_HOVER
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = DISCORD_BLURPLE
        }}
      >
        <DiscordMarkIcon className="shrink-0" size={24} />
        <span className="whitespace-nowrap">Join us on Discord →</span>
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
