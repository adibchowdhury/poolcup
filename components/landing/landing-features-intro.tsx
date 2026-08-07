import {
  RevealItem,
  ScrollRevealGroup,
} from '@/components/landing/scroll-reveal'

/**
 * Light signpost before the five feature blocks — a breath, not a hero.
 * Sits on the shared features hue (`#090f18`) so sports → intro → 01 melt.
 */
export function LandingFeaturesIntro() {
  return (
    <section
      className="relative overflow-hidden bg-[#090f18] py-12 md:py-16"
      aria-labelledby="features-intro-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 50% at 50% 40%, rgba(0,230,118,0.06) 0%, transparent 65%)',
        }}
      />

      <div className="relative z-[1] mx-auto max-w-3xl px-6 text-center">
        <ScrollRevealGroup>
          <RevealItem index={0}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00e676] sm:text-xs">
              Why PoolCup
            </p>
          </RevealItem>
          <RevealItem index={1}>
            <h2
              id="features-intro-heading"
              className="mt-3 font-display text-3xl leading-[1.15] tracking-wide text-[#f0f4f8] sm:text-4xl md:text-[2.4rem] md:leading-[1.12]"
            >
              Everything you need to play.
            </h2>
          </RevealItem>
          <RevealItem index={2}>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#728d9c] sm:text-base">
              The tools that make every prediction more fun with your friends.
            </p>
          </RevealItem>
        </ScrollRevealGroup>
      </div>
    </section>
  )
}
