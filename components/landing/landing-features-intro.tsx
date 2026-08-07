import {
  RevealItem,
  ScrollRevealGroup,
} from '@/components/landing/scroll-reveal'

/**
 * Light signpost before the five feature blocks — a breath, not a hero.
 * Sits on the shared features hue (`#090f18`) so sports → intro → 01 melt.
 *
 * Spacing note: sports showcase has NO bottom padding; feature 01 owns most of
 * the gap below via its own top padding — keep this section’s pb small.
 */
export function LandingFeaturesIntro() {
  return (
    <section
      className="relative overflow-hidden bg-[#090f18] pt-28 pb-4 md:pt-36 md:pb-6"
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

      <div className="relative z-[1] mx-auto max-w-5xl px-5 text-center sm:px-6">
        <ScrollRevealGroup>
          <RevealItem index={0}>
            <h2
              id="features-intro-heading"
              className="mx-auto whitespace-nowrap font-display leading-none tracking-wide text-[#f0f4f8] text-[clamp(1.8rem,5.8vw,3.5rem)]"
            >
              Everything you need to play.
            </h2>
          </RevealItem>
          <RevealItem index={1}>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#728d9c] sm:text-base">
              The tools that make every prediction more fun with your friends.
            </p>
          </RevealItem>
        </ScrollRevealGroup>
      </div>
    </section>
  )
}
