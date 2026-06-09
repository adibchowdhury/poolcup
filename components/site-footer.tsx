'use client'

import Link from 'next/link'
import {
  ChevronUp,
  Facebook,
  Instagram,
  Linkedin,
  Trophy,
  Twitter,
} from 'lucide-react'

type FooterLink =
  | { label: string; href: string; external?: boolean }
  | { label: string; hash: string }

const siteMap: FooterLink[] = [
  { label: 'How it works', hash: '#how-it-works' },
  { label: 'Features', hash: '#features' },
  { label: 'Pricing', hash: '#pricing' },
  { label: 'Contact Support', href: '/contact' },
  { label: 'Sign in', href: '/login' },
]

const legal: { label: string; href: string }[] = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'How We Protect Your Data', href: '/security' },
]

const STRIPE_DONATE_URL =
  'https://donate.stripe.com/aFa9ASayG42Q9P5g1K4ZG00'

const socialLinks = [
  { label: 'Twitter', href: 'https://twitter.com', icon: Twitter },
  { label: 'LinkedIn', href: 'https://linkedin.com', icon: Linkedin },
  { label: 'Instagram', href: 'https://instagram.com', icon: Instagram },
  { label: 'Facebook', href: 'https://facebook.com', icon: Facebook },
] as const

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

type SiteFooterProps = {
  backgroundClass?: string
}

export function SiteFooter({ backgroundClass = 'bg-[#0d1520]' }: SiteFooterProps) {
  const year = new Date().getFullYear()

  const scrollToTop = () => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className={`${backgroundClass} font-sans text-[#f0f4f8]`}>
      <div className="border-t border-[rgba(255,255,255,0.08)] bg-[#111a27]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:py-16 md:grid-cols-[1.4fr_1fr_1fr]">
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
              Private World Cup 2026 prediction pools for your office, group chat,
              or friends. Everyone predicts match scores — the app keeps score and
              updates the leaderboard automatically.
            </p>

            <a
              href={STRIPE_DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center rounded-lg border border-[#4800AE] bg-[#4800AE] px-4 py-2.5 font-sans text-sm font-semibold text-white transition-colors hover:border-[#5A10C4] hover:bg-[#5A10C4]"
            >
              Support Us
            </a>

            <div className="mt-4 flex items-center gap-4 font-sans text-[#5a7080]">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="transition-colors hover:text-primary"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>

            <button
              type="button"
              onClick={scrollToTop}
              className="mt-8 inline-flex items-center gap-2 rounded-md border border-[rgba(255,255,255,0.15)] px-5 py-2.5 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-[#5a7080] transition-colors hover:border-primary hover:text-primary"
            >
              <ChevronUp className="h-4 w-4" />
              Back to top
            </button>
          </div>

          <div>
            <h3 className="font-footer-heading text-[#f0f4f8]">Site Map</h3>
            <ul className="mt-5 space-y-3">
              {siteMap.map((item) => (
                <li key={item.label}>
                  <FooterLinkItem item={item} />
                </li>
              ))}
            </ul>
          </div>

          <div>
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

      <div className="bg-primary py-3 text-center font-sans text-xs font-medium text-primary-foreground">
        Copyright © {year} PoolCup. All rights reserved.
      </div>
    </footer>
  )
}
