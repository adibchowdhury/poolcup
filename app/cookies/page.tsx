import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { SiteFooter } from '@/components/site-footer'

export default function CookiesPage() {
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
          Legal
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
          Cookie Policy
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Last updated: May 21, 2026
        </p>

        <div className="mt-12 space-y-10 text-foreground">
          <section>
            <h2 className="font-display text-2xl tracking-wide">1. What Are Cookies?</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Cookies are small text files stored on your device when you visit a website.
              Similar technologies include local storage, session storage, and pixels. We use
              these tools to run PoolCup, keep you signed in, and understand how the site is
              used. For broader data practices, see our{' '}
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              2. Cookies We Use
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              PoolCup uses the following categories of cookies and similar storage:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">Strictly necessary</strong> — required
                for the site to work, including authentication and security. These cannot be
                disabled if you want to use signed-in features.
              </li>
              <li>
                <strong className="text-foreground">Functional</strong> — remember
                preferences (for example, UI state) so the app behaves consistently between
                visits.
              </li>
              <li>
                <strong className="text-foreground">Analytics</strong> — help us understand
                traffic and usage patterns so we can improve reliability and features. Where
                used, they are aggregated and not sold to advertisers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              3. Third-Party Cookies
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Some cookies are set by services we integrate with:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">Supabase</strong> — session and
                authentication tokens so you can sign in and stay signed in securely.
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Those providers handle data under their own policies. We do not use third-party
              advertising cookies to track you across unrelated websites.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              4. How Long Cookies Last
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Session cookies expire when you close your browser. Persistent cookies and
              local storage may remain for a set period (for example, to keep you signed in
              until you sign out or until the token expires). Authentication tokens are
              refreshed according to our auth provider&apos;s settings.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              5. Managing Cookies
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Most browsers let you block or delete cookies in settings. Blocking strictly
              necessary cookies may prevent sign-in or pool access. You can also
              sign out of PoolCup to clear active session state on your device.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              For browser-specific instructions, check your browser&apos;s help documentation
              (Chrome, Firefox, Safari, Edge, and others).
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              6. Do Not Track
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Some browsers send a &quot;Do Not Track&quot; signal. There is no uniform
              industry standard for responding to these signals; we currently do not change
              our practices solely based on DNT.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              7. Changes to This Policy
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We may update this Cookie Policy from time to time. The &quot;Last updated&quot;
              date at the top will change when we do. Continued use of PoolCup after updates
              means you accept the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">8. Contact Us</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Questions about cookies or this policy? Email{' '}
              <a
                href="mailto:support@getpoolcup.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                support@getpoolcup.com
              </a>{' '}
              or use our{' '}
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
