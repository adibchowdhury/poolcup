import { PublicPageShell } from '@/components/public-page-shell'
import { CollegeFootballPickEmContent } from '@/components/college-football-pick-em/college-football-pick-em-content'
import { CollegeFootballPickEmHeroCtas } from '@/components/college-football-pick-em/college-football-pick-em-hero-ctas'
import { buildCfbPickEmFaqJsonLd } from '@/src/lib/college-football-pick-em-faq'
import {
  CFB_PICK_EM_EVENT_SLUG,
  cfbPickEmSeasonUnderwayLine,
} from '@/src/lib/college-football-pick-em-season'
import { fetchPickEmSlateByEventSlug } from '@/src/lib/pick-em-marketing-slate'

export const revalidate = 3600

/**
 * /college-football-pick-em — hero + content + slate + FAQ + FAQPage JSON-LD.
 * Slate resolves sporting_events.slug at query time (ncaa-football-2026).
 */
export default async function CollegeFootballPickEmPage() {
  const slate = await fetchPickEmSlateByEventSlug(CFB_PICK_EM_EVENT_SLUG)
  const faqJsonLd = buildCfbPickEmFaqJsonLd()

  const slateEmptyState = !slate.eventExists
    ? 'prelaunch'
    : slate.isOffseason
      ? 'offseason'
      : 'loading'

  return (
    <PublicPageShell
      pageBackgroundClass="bg-[#0a0e12]"
      footerBackgroundClass="bg-[#0a0e12]"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section
        className="px-6 pb-16 pt-12 md:pb-20 md:pt-16"
        aria-labelledby="cfb-pick-em-hero-heading"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h1
            id="cfb-pick-em-hero-heading"
            className="font-display text-4xl tracking-wide text-[#f0f4f8] md:text-5xl lg:text-6xl"
          >
            College Football Pick&apos;em
          </h1>
          <p className="mt-4 text-lg text-[#c5d0d8] md:text-xl">
            Pick the winners. Beat your friends. Saturdays just got personal.
          </p>
          <p className="mt-3 text-sm font-medium text-[#00e676] md:text-base">
            {cfbPickEmSeasonUnderwayLine()}
          </p>

          <CollegeFootballPickEmHeroCtas />
        </div>
      </section>

      <CollegeFootballPickEmContent
        upcomingMatches={slate.matches}
        slateEmptyState={slateEmptyState}
      />
    </PublicPageShell>
  )
}
