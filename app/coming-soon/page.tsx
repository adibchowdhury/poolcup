import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PoolCup — Coming Soon',
  description:
    'PoolCup is building the future of prediction pools. Something big is coming.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ComingSoonPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/4 top-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/4 h-96 w-96 rounded-full bg-[#ffb300]/10 blur-3xl" />
      </div>

      <main className="relative z-10 flex max-w-lg flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/poolcup-logo.png"
          alt="PoolCup"
          className="h-14 w-auto object-contain sm:h-16"
        />

        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          Coming soon
        </p>

        <h1 className="mt-4 font-display text-4xl tracking-wide text-foreground sm:text-5xl">
          Something big is coming
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          We&apos;re building the future of prediction pools. Check back soon.
        </p>
      </main>
    </div>
  )
}
