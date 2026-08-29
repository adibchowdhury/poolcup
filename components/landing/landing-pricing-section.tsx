'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import {
  landingTactileCommissionerClass,
  landingTactileOutlineGreenClass,
  landingTactilePointerDown,
  landingTactilePrimaryClass,
} from '@/components/landing/landing-tactile-classes'
import { capturePostHog } from '@/src/lib/posthog-client'

const CREATE_HREF = '/create'

type OfferId = 'free' | 'custom'

type PricingOffer = {
  id: OfferId
  name: string
  price: string
  priceNote: string
  tagline: string
  audience: string
  ctaLabel: string
  ctaHref: string
  features: string[]
  highlight?: boolean
}

const OFFERS: PricingOffer[] = [
  {
    id: 'free',
    name: 'Free for players',
    price: '$0',
    priceNote: 'Always free',
    tagline: 'Everything you need to play.',
    audience: 'Create unlimited Basic pools. Join as many as you want.',
    ctaLabel: 'Start playing free',
    ctaHref: CREATE_HREF,
    features: [
      'Predictions & live leaderboards',
      'Unlimited Basic pools',
      'Pool chat & friends',
      'Analytics & prediction history',
      'Profile themes & badges',
      'Works across every league',
    ],
  },
  {
    id: 'custom',
    name: 'Custom Pool',
    price: '$9.99',
    priceNote: 'One-time · per pool',
    tagline: 'Upgrade the pool you run.',
    audience: 'Only the pool owner pays. Members always play free.',
    ctaLabel: 'Create a pool',
    ctaHref: CREATE_HREF,
    highlight: true,
    features: [
      'Custom logo & colors',
      'Custom scoring',
      'Announcements & polls',
      'Co-commissioners',
      'Moderation tools',
      'Missing-picks tracking & exports',
    ],
  },
]

const COMPARISON_ROWS: {
  feature: string
  free: boolean | string
  custom: boolean | string
}[] = [
  { feature: 'Predictions & leaderboards', free: true, custom: true },
  { feature: 'Unlimited Basic pools', free: true, custom: true },
  { feature: 'Chat, friends & analytics', free: true, custom: true },
  { feature: 'Custom logo & colors', free: false, custom: true },
  { feature: 'Custom scoring', free: false, custom: true },
  { feature: 'Announcements & polls', free: false, custom: true },
  { feature: 'Co-commissioners & moderation', free: false, custom: true },
  { feature: 'Missing-picks tracking & exports', free: false, custom: true },
]

const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: 'Is PoolCup really free?',
    a: 'Yes. Players get predictions, pools, leaderboards, analytics, history, chat, friends, and themes at no cost. You can create unlimited Basic pools for free.',
  },
  {
    q: 'What does the pool upgrade include?',
    a: 'Custom Pool ($9.99 one-time) unlocks commissioner tools on that pool: custom logo and colors, custom scoring, announcements, polls, co-commissioners, moderation tools, missing-picks tracking, and exports.',
  },
  {
    q: 'Is it recurring?',
    a: (
      <>
        No. Custom Pool is a one-time purchase per pool — not a subscription.
        See the{' '}
        <Link
          href="/terms#payments-refunds"
          className="text-[#00e676] underline-offset-4 hover:underline"
        >
          payments &amp; refunds
        </Link>{' '}
        section in our Terms.
      </>
    ),
  },
  {
    q: 'Who pays — do my members need to pay?',
    a: 'Only the pool owner pays if they want Custom Pool tools. Members always play free. Upgrade any existing pool from its settings.',
  },
]

function ComparisonCell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-[#f0f4f8]">{value}</span>
  }
  return value ? (
    <Check
      className="mx-auto h-4 w-4 text-[#00e676]"
      aria-label="Included"
      strokeWidth={2.5}
    />
  ) : (
    <span className="text-sm text-[#5a7080]/50" aria-label="Not included">
      —
    </span>
  )
}

function OfferCard({ offer }: { offer: PricingOffer }) {
  const ctaClassName = cn(
    'mt-8 mb-1.5 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1620]',
    offer.highlight
      ? landingTactileCommissionerClass
      : landingTactileOutlineGreenClass,
  )

  return (
    <article
      className={cn(
        'relative flex h-full flex-col rounded-2xl border p-6 sm:p-7',
        offer.highlight
          ? 'border-[rgba(255,193,7,0.35)] bg-gradient-to-b from-[#1a160c] via-[#12100a] to-[#0a0e12] shadow-[0_0_40px_rgba(255,193,7,0.08)]'
          : 'border-[rgba(255,255,255,0.1)] bg-[#0f1620]',
      )}
    >
      {offer.highlight ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#ffc107] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#080b0f]">
          One-time upgrade
        </span>
      ) : null}

      <div className="min-h-[1.25rem]">
        <h3 className="font-display text-2xl tracking-wide text-[#f0f4f8]">
          {offer.name}
        </h3>
        <p className="mt-1 text-sm text-[#728d9c]">{offer.tagline}</p>
      </div>

      <div className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            'font-display text-4xl tracking-wide sm:text-5xl',
            offer.highlight ? 'text-[#ffc107]' : 'text-[#00e676]',
          )}
        >
          {offer.price}
        </span>
        <span className="text-sm text-[#5a7080]">{offer.priceNote}</span>
      </div>
      <p className="mt-2 text-xs text-[#5a7080]">{offer.audience}</p>

      <ul className="mt-7 flex-1 space-y-3">
        {offer.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2.5 text-sm text-[#f0f4f8]/95"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#00e676]/40 bg-[#00e676]/12">
              <Check
                className="h-3 w-3 text-[#00e676]"
                strokeWidth={3}
                aria-hidden
              />
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={offer.ctaHref}
        onPointerDown={landingTactilePointerDown}
        className={ctaClassName}
      >
        {offer.ctaLabel}
      </Link>
    </article>
  )
}

/**
 * /pricing page content: Free vs Custom Pool, comparison, FAQ.
 */
export function LandingPricingSection() {
  useEffect(() => {
    capturePostHog('pricing_viewed')
  }, [])

  return (
    <div className="bg-[#0a0e12]">
      <section
        className="px-6 pb-16 pt-14 md:pb-20 md:pt-20"
        aria-labelledby="pricing-heading"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h1
              id="pricing-heading"
              className="font-display text-4xl leading-[1.1] tracking-wide text-[#f0f4f8] md:text-5xl lg:text-6xl"
            >
              <span className="block">Free for players.</span>
              <span className="mt-1 block text-[#00e676]">
                Upgrade your pool once.
              </span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[#728d9c] md:text-lg">
              Pay once per pool. No subscription. Everyone else plays free.
            </p>
            <p className="mt-3 text-sm text-[#5a7080]">
              Already running a pool? Upgrade any pool from its settings.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-5 lg:mx-auto lg:max-w-4xl">
            {OFFERS.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-[#5a7080]">
            ✓ No credit card required to start
          </p>
        </div>
      </section>

      <section
        className="border-t border-[rgba(255,255,255,0.06)] bg-[#0a0e12] px-6 py-16 md:py-20"
        aria-labelledby="comparison-heading"
      >
        <div className="mx-auto max-w-4xl">
          <h2
            id="comparison-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            Free vs Custom Pool
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[#728d9c] md:text-base">
            Players get the full game free. Custom Pool adds commissioner tools
            on a single pool — $9.99 one-time.
          </p>

          <div className="mt-10 overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0a0e12]">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.08)] text-[#728d9c]">
                  <th className="px-4 py-3.5 text-left font-medium sm:px-5">
                    Feature
                  </th>
                  <th className="px-3 py-3.5 text-center font-medium">
                    Free
                  </th>
                  <th className="px-3 py-3.5 text-center font-medium text-[#ffc107]">
                    Custom Pool
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-[rgba(255,255,255,0.05)] last:border-0"
                  >
                    <td className="px-4 py-3 text-[#f0f4f8]/90 sm:px-5">
                      {row.feature}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <ComparisonCell value={row.free} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <ComparisonCell value={row.custom} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={CREATE_HREF}
              onPointerDown={landingTactilePointerDown}
              className={cn(
                landingTactilePrimaryClass,
                'inline-flex min-h-11 items-center justify-center rounded-lg px-6 text-sm font-semibold',
              )}
            >
              Create a pool
            </Link>
            <p className="text-center text-sm text-[#5a7080]">
              Or upgrade an existing pool from settings
            </p>
          </div>
        </div>
      </section>

      <section
        className="border-t border-[rgba(255,255,255,0.06)] bg-[#0a0e12] px-6 py-16 md:py-20"
        aria-labelledby="faq-heading"
      >
        <div className="mx-auto max-w-2xl">
          <h2
            id="faq-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            Common questions
          </h2>
          <Accordion type="single" collapsible className="mt-10 w-full">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem
                key={item.q}
                value={`faq-${index}`}
                className="border-[rgba(255,255,255,0.08)]"
              >
                <AccordionTrigger className="text-left text-[#f0f4f8] hover:text-[#00e676] hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-[#728d9c]">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  )
}
