import { PublicPageShell } from '@/components/public-page-shell'
import { NflPickEmHeroCtas } from '@/components/nfl-pick-em/nfl-pick-em-hero-ctas'
import { NflPickEmContent } from '@/components/nfl-pick-em/nfl-pick-em-content'
import { fetchNflPickEmSlate } from '@/src/lib/fetch-nfl-pick-em-slate'
import { buildNflPickEmFaqJsonLd } from '@/src/lib/nfl-pick-em-faq'

/**
 * Intended ISR window for the slate fetch. Moot in practice: root layout
 * `generateMetadata` awaits `headers()`, and `createServerSupabaseClient`
 * reads `cookies()`, so this route stays dynamic (per-request query).
 * Cost remains one indexed matches select either way.
 */
export const revalidate = 3600

/**
 * /nfl-pick-em — hero + content + slate + FAQ + FAQPage JSON-LD.
 * Server Component: visible copy and schema ship in the initial HTML.
 */
export default async function NflPickEmPage() {
  const upcomingMatches = await fetchNflPickEmSlate()
  const faqJsonLd = buildNflPickEmFaqJsonLd()

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
        aria-labelledby="nfl-pick-em-hero-heading"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h1
            id="nfl-pick-em-hero-heading"
            className="font-display text-4xl tracking-wide text-[#f0f4f8] md:text-5xl lg:text-6xl"
          >
            NFL Pick&apos;em
          </h1>
          <p className="mt-4 text-lg text-[#c5d0d8] md:text-xl">
            Pick the winners. Compete with friends. See who knows football best.
          </p>
          <p className="mt-3 text-sm font-medium text-[#00e676] md:text-base">
            The 2026 NFL season kicks off September 10 — get your pool ready.
          </p>

          <NflPickEmHeroCtas />
        </div>
      </section>

      <NflPickEmContent upcomingMatches={upcomingMatches} />
    </PublicPageShell>
  )
}
