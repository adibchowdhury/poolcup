import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { SiteFooter } from '@/components/site-footer'

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link
            href="/"
            className="group rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
          </Link>
          <PoolCupLogo />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wider text-primary">
          Security
        </p>

        <h1 className="mt-3 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
          How We Protect Your Data
        </h1>

        <p className="mt-4 text-sm text-muted-foreground">
          Last updated: May 21, 2026
        </p>

        <div className="mt-12 space-y-10 text-foreground">
          <section>
            <p className="leading-relaxed text-muted-foreground">
              We take security seriously.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              PoolCup helps friends and colleagues run private World Cup prediction
              pools. That only works if your account, predictions, and pool data stay
              protected. From day one, we built the app with modern security practices
              and privacy in mind. See also our{' '}
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              Authentication & Access
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We use secure authentication powered by Supabase.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                Sign-in, sign-up, and session management use industry-standard auth flows
              </li>
              <li>Password reset is handled through protected email links</li>
              <li>
                Pool and prediction data is tied to your account; invite links control who
                can join a given pool
              </li>
              <li>
                Server-side checks and database policies limit what each user can read or
                change
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">Data Protection</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>All traffic to PoolCup is served over HTTPS</li>
              <li>Sensitive data is encrypted in transit between your browser and our providers</li>
              <li>
                Each user&apos;s predictions and membership are isolated; you only see pools
                you belong to
              </li>
              <li>
                Supabase Row Level Security (RLS) helps ensure users can only access rows
                they are allowed to see or update
              </li>
              <li>We follow the principle of least privilege for internal access</li>
              <li>
                We do not store card numbers on our servers
              </li>
              <li>We do not sell your personal data</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              Application Security
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                API routes validate input and run on the server, not in the public browser
              </li>
              <li>
                Authentication tokens and secrets are kept out of client-side code where
                possible
              </li>
              <li>
                We rely on platform and framework defaults to reduce common web risks such
                as cross-site scripting and injection
              </li>
              <li>
                Invite codes and pool slugs are used for sharing; treat invite links like
                passwords for private pools
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We review security as we ship new features, especially around predictions,
              scoring, and account access.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">Infrastructure</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              PoolCup is built on trusted infrastructure used by modern web applications:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>Next.js application hosted on a secure edge platform (e.g. Vercel)</li>
              <li>Database, authentication, and storage managed by Supabase</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              Ongoing Improvements
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Security isn&apos;t a one-time setup. We continuously review and improve our
              practices as the product and tournament season evolve—including access
              controls, dependency updates, and incident response.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              Report a Security Issue
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              If you believe you&apos;ve found a vulnerability or security issue, please
              reach out. Do not post sensitive details publicly.
            </p>
            <p className="mt-2">
              <a
                href="mailto:security@getpoolcup.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                security@getpoolcup.com
              </a>
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              For general account help, use our{' '}
              <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
                contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
