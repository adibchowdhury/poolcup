import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'

export default function TermsPage() {
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
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-display text-xl tracking-wider text-primary"
          >
            <Trophy className="h-5 w-5" />
            POOLCUP
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wider text-primary">
          Legal
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Last updated: May 21, 2026
        </p>

        <div className="mt-12 space-y-10 text-foreground">
          <section>
            <h2 className="font-display text-2xl tracking-wide">
              1. Acceptance of Terms
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              By accessing or using PoolCup at{' '}
              <a
                href="https://www.getpoolcup.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                www.getpoolcup.com
              </a>{' '}
              (the &quot;Service&quot;), you agree to these Terms of Service and our{' '}
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              . If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              2. Description of Service
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              PoolCup lets users create private World Cup prediction pools, invite
              members, submit match score predictions, and view automated scoring and
              leaderboards. Match schedules and results are provided from third-party
              sources; we strive for accuracy but do not guarantee that all data is
              complete or error-free.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              3. Accounts & Eligibility
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              You must provide accurate registration information and keep your account
              credentials secure. You are responsible for activity under your account.
              You must be old enough to enter a binding agreement where you live (and at
              least 13 years old). One person may not maintain multiple accounts to
              manipulate pools or leaderboards.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              4. Pools
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              PoolCup is free to use. Creating a pool and joining a pool do not require
              any fee through the Service.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              PoolCup does not operate real-money gambling or wagering. Any prizes or
              stakes between pool members are solely between those members; we are not a
              party to informal bets or payouts.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              5. Predictions, Deadlines & Scoring
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Predictions must be submitted before the deadline shown in the app (typically
              before kickoff). Late or edited predictions may not be accepted after a
              match starts. Scoring rules are applied automatically based on published
              match results. We may correct scoring errors when identified. Leaderboards
              are provided for entertainment among pool members, not as official
              rankings.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">6. Acceptable Use</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              You agree not to misuse the Service, including by: violating laws;
              harassing others; impersonating another person; scraping or reverse
              engineering the app without permission; attempting to disrupt or overload
              our systems; sharing invite links publicly in a way that violates a
              private pool&apos;s intent; or uploading malicious code. We may suspend or
              terminate accounts that violate these rules.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              7. Intellectual Property
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              PoolCup&apos;s name, branding, software, and site content are owned by us or
              our licensors. You retain ownership of content you submit (such as pool
              names and predictions), but you grant us a license to host, display, and
              process that content solely to operate the Service. FIFA, World Cup, and
              related marks belong to their respective owners; PoolCup is not affiliated
              with or endorsed by FIFA.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              8. Disclaimer of Warranties
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
              WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING
              IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT. WE DO NOT WARRANT UNINTERRUPTED OR ERROR-FREE OPERATION.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              9. Limitation of Liability
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, POOLCUP AND ITS OPERATORS WILL NOT
              BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
              DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF
              THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS
              LIMITED TO THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE MONTHS
              BEFORE THE CLAIM OR (B) USD $50.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">10. Termination</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              You may stop using the Service at any time. We may suspend or terminate
              access if you breach these Terms or if we discontinue the Service. Sections
              that by nature should survive (including disclaimers, limitations of
              liability, and governing law) will survive termination.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              11. Changes to These Terms
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We may update these Terms from time to time. The &quot;Last updated&quot;
              date will change when we do. Material changes may be communicated via the
              site or email. Continued use after changes take effect constitutes
              acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">12. General</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              These Terms are governed by the laws applicable in our place of business,
              without regard to conflict-of-law rules. If any provision is held invalid,
              the remaining provisions remain in effect. Our failure to enforce a right
              does not waive that right.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">13. Contact Us</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Questions about these Terms? Email{' '}
              <a
                href="mailto:legal@getpoolcup.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                legal@getpoolcup.com
              </a>{' '}
              or visit our{' '}
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
