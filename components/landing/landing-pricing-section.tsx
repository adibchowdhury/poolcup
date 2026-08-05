'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

const SIGNUP_HREF = '/login?next=/create'

type BillingPeriod = 'monthly' | 'yearly'

type TierId = 'free' | 'pro' | 'commissioner'

type PricingTier = {
  id: TierId
  name: string
  tagline: string
  audience: string
  monthlyPrice: string
  yearlyPrice: string
  ctaLabel: string
  features: string[]
  popular?: boolean
  premium?: boolean
}

const TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Everything you need to play.',
    audience: 'Most players start here.',
    monthlyPrice: '$0',
    yearlyPrice: '$0',
    ctaLabel: 'Start Playing',
    features: [
      'Predictions & leaderboards',
      'Friends & pool chat',
      'Badges & multi-sport',
      'Create or join pools',
      'Works across every league',
    ],
  },
  {
    id: 'pro',
    name: 'PoolCup Pro',
    tagline: 'Compete smarter.',
    audience: 'For superfans.',
    monthlyPrice: '$4.99',
    yearlyPrice: '$49.99',
    ctaLabel: 'Go Pro',
    popular: true,
    features: [
      'Everything in Free',
      'Match insights & prediction trends',
      'Advanced analytics & AI insights',
      'Custom profile & themes',
      'Exclusive badges',
      'Prediction history & win probability',
    ],
  },
  {
    id: 'commissioner',
    name: 'Pool Commissioner',
    tagline: 'Run your own tournament.',
    audience: 'Perfect for leagues & organizations.',
    monthlyPrice: '$9.99',
    yearlyPrice: '$99.99',
    ctaLabel: 'Become a Commissioner',
    premium: true,
    features: [
      'Everything in Pro',
      'Unlimited custom pools',
      'Admin controls & custom scoring',
      'Announcements, polls & branding',
      'Money pool tracking & exports',
      'Scheduling tools',
    ],
  },
]

const COMPARISON_ROWS: {
  feature: string
  free: boolean | string
  pro: boolean | string
  commissioner: boolean | string
}[] = [
  { feature: 'Predictions & leaderboards', free: true, pro: true, commissioner: true },
  { feature: 'Friends & pool chat', free: true, pro: true, commissioner: true },
  { feature: 'Badges & multi-sport', free: true, pro: true, commissioner: true },
  { feature: 'Advanced analytics & AI insights', free: false, pro: true, commissioner: true },
  { feature: 'Custom profile & premium badges', free: false, pro: true, commissioner: true },
  { feature: 'Unlimited custom pools', free: false, pro: true, commissioner: true },
  { feature: 'Admin tools & custom scoring', free: false, pro: false, commissioner: true },
  { feature: 'Announcements, polls & branding', free: false, pro: false, commissioner: true },
  { feature: 'Money pool tracking & exports', free: false, pro: false, commissioner: true },
]

const FAQ_ITEMS = [
  {
    q: "What's included in the free plan?",
    a: 'Free includes predictions, leaderboards, friends, pool chat, badges, and the ability to create or join pools across leagues — everything you need to play with your crew.',
  },
  {
    q: "What's the difference between Pro and Commissioner?",
    a: 'Pro is built for players who want deeper insights, analytics, and personalization. Commissioner adds admin tools, custom scoring, branding, announcements, and money-pool tracking for people who run leagues.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Paid plans are month-to-month (or yearly if you choose that option). You can cancel anytime — billing is not live yet, and CTAs currently take you to sign up.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. You can create an account and start on Free with no credit card required.',
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
    <Minus
      className="mx-auto h-4 w-4 text-[#5a7080]/50"
      aria-label="Not included"
    />
  )
}

function PricingCard({
  tier,
  period,
}: {
  tier: PricingTier
  period: BillingPeriod
}) {
  const price =
    period === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice
  const periodLabel = period === 'monthly' ? '/month' : '/year'

  return (
    <article
      className={cn(
        'relative flex h-full flex-col rounded-2xl border p-6 sm:p-7',
        tier.popular &&
          'border-[#00e676]/55 bg-gradient-to-b from-[#0c1a14] to-[#0a0e12] shadow-[0_0_0_1px_rgba(0,230,118,0.12),0_0_48px_rgba(0,230,118,0.16)]',
        tier.premium &&
          'border-[rgba(255,193,7,0.35)] bg-gradient-to-b from-[#1a160c] via-[#12100a] to-[#0a0e12] shadow-[0_0_40px_rgba(255,193,7,0.08)]',
        !tier.popular &&
          !tier.premium &&
          'border-[rgba(255,255,255,0.1)] bg-[#0f1620]',
      )}
    >
      {tier.popular ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#00e676] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#080b0f]">
          Most Popular
        </span>
      ) : null}

      <div className="min-h-[1.25rem]">
        <h3 className="font-display text-2xl tracking-wide text-[#f0f4f8]">
          {tier.name}
        </h3>
        <p className="mt-1 text-sm text-[#728d9c]">{tier.tagline}</p>
      </div>

      <div className="mt-6 flex items-baseline gap-1">
        <span
          className={cn(
            'font-display text-4xl tracking-wide sm:text-5xl',
            tier.popular ? 'text-[#00e676]' : 'text-[#f0f4f8]',
          )}
        >
          {price}
        </span>
        {tier.id !== 'free' ? (
          <span className="text-sm text-[#5a7080]">{periodLabel}</span>
        ) : (
          <span className="text-sm text-[#5a7080]">forever</span>
        )}
      </div>
      <p className="mt-2 text-xs text-[#5a7080]">{tier.audience}</p>

      <ul className="mt-7 flex-1 space-y-3">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-[#f0f4f8]/95">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#00e676]/40 bg-[#00e676]/12">
              <Check className="h-3 w-3 text-[#00e676]" strokeWidth={3} aria-hidden />
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/*
        TODO(billing): Wire this CTA to the real Free / Pro / Commissioner
        Stripe subscription checkout once billing exists.
      */}
      <Link
        href={SIGNUP_HREF}
        className={cn(
          'mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1620]',
          tier.popular
            ? 'bg-[#00e676] text-[#080b0f] hover:bg-[#00e676]/90'
            : tier.premium
              ? 'border border-[rgba(255,193,7,0.45)] bg-[rgba(255,193,7,0.1)] text-[#ffc107] hover:bg-[rgba(255,193,7,0.16)]'
              : 'border border-[#00e676]/40 text-[#00e676] hover:bg-[#00e676]/10',
        )}
      >
        {tier.ctaLabel}
      </Link>
    </article>
  )
}

/**
 * Full /pricing page content: 3 expanded cards, comparison table, FAQ.
 */
export function LandingPricingSection() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly')
  const toggleId = useId()

  return (
    <div className="bg-[#0a0e12]">
      {/* Hero copy + toggle + cards */}
      <section className="px-6 pb-16 pt-14 md:pb-20 md:pt-20" aria-labelledby="pricing-heading">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h1
              id="pricing-heading"
              className="font-display text-4xl leading-[1.1] tracking-wide text-[#f0f4f8] md:text-5xl lg:text-6xl"
            >
              <span className="block">Free Forever.</span>
              <span className="mt-1 block text-[#00e676]">
                Upgrade When You&apos;re Ready.
              </span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[#728d9c] md:text-lg">
              Predict matches, compete with friends, and join public pools at no
              cost.
            </p>
          </div>

          {/* Monthly / Yearly toggle */}
          <div className="mt-10 flex justify-center">
            <div
              role="group"
              aria-labelledby={toggleId}
              className="inline-flex rounded-full border border-[rgba(255,255,255,0.12)] bg-[#0f1620] p-1"
            >
              <span id={toggleId} className="sr-only">
                Billing period
              </span>
              {(['monthly', 'yearly'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPeriod(option)}
                  aria-pressed={period === option}
                  className={cn(
                    'rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors',
                    period === option
                      ? 'bg-[#00e676] text-[#080b0f]'
                      : 'text-[#728d9c] hover:text-[#f0f4f8]',
                  )}
                >
                  {option}
                  {option === 'yearly' ? (
                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide opacity-80">
                      Save
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-5 xl:gap-6">
            {TIERS.map((tier) => (
              <PricingCard key={tier.id} tier={tier} period={period} />
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-[#5a7080]">
            ✓ No credit card required to start
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section
        className="border-t border-[rgba(255,255,255,0.06)] bg-[#0a0e12] px-6 py-16 md:py-20"
        aria-labelledby="comparison-heading"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="comparison-heading"
            className="text-center font-display text-3xl tracking-wide text-[#f0f4f8] md:text-4xl"
          >
            Free vs Pro vs Commissioner at a glance
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[#728d9c] md:text-base">
            See what&apos;s included in each plan.
          </p>

          <div className="mt-10 overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0a0e12]">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.08)] text-[#728d9c]">
                  <th className="px-4 py-3.5 text-left font-medium sm:px-5">
                    Feature
                  </th>
                  <th className="px-3 py-3.5 text-center font-medium">Free</th>
                  <th className="px-3 py-3.5 text-center font-medium text-[#00e676]">
                    Pro
                  </th>
                  <th className="px-3 py-3.5 text-center font-medium">
                    Commissioner
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
                      <ComparisonCell value={row.pro} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <ComparisonCell value={row.commissioner} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
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
