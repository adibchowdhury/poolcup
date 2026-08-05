import Link from 'next/link'
import { PublicPageShell } from '@/components/public-page-shell'

export default function PrivacyPage() {
  return (
    <PublicPageShell>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wider text-primary">
          Legal
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Last updated: May 21, 2026
        </p>

        <div className="mt-12 space-y-10 text-foreground">
          <section>
            <h2 className="font-display text-2xl tracking-wide">
              1. Information We Collect
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We collect information you provide when you use PoolCup, including:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">Account data</strong> — such as
                your email address and display name when you sign up or sign in.
              </li>
              <li>
                <strong className="text-foreground">Pool & prediction data</strong>{' '}
                — pool names, membership in pools, match score predictions, and
                related leaderboard information.
              </li>
              <li>
                <strong className="text-foreground">Billing-related data</strong> —
                PoolCup is currently free to use. If billing features are added in the
                future, we will update this policy before they launch.
              </li>
              <li>
                <strong className="text-foreground">Communications</strong> — if you
                contact us through our support form or email, we keep the content of
                those messages to respond to you.
              </li>
              <li>
                <strong className="text-foreground">Usage data</strong> — such as
                pages visited, device/browser type, and general interaction data to
                keep the service reliable and improve the product.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              2. How We Use Your Information
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We use your information to operate PoolCup: authenticate you, create and
              manage prediction pools, record and score predictions, display
              leaderboards, and send service-related messages (for example, account or
              security notices). We do not sell your personal information to third
              parties.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              3. Third-Party Services
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We rely on trusted providers to run the app. These may process data on our
              behalf under their own privacy policies:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">Supabase</strong> — authentication,
                database, and application hosting.
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Match schedules and results may be sourced from third-party sports data
              providers; those feeds do not include your personal account details.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              4. Data Storage & Security
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Data is transmitted over HTTPS and stored using industry-standard
              practices through our infrastructure providers. Access to production
              systems is limited to what is needed to operate and support the service.
              No method of transmission or storage is 100% secure; if you believe your
              account has been compromised, contact us promptly.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              5. Data Retention
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Pool chat messages are retained for 90 days, after which they are
              automatically deleted. Messages that have been reported may be retained
              longer where necessary to review and act on the report.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">6. Cookies</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We use cookies and similar technologies to keep you signed in, remember
              preferences, and understand how the site is used. You can control cookies
              through your browser settings. See our{' '}
              <Link href="/cookies" className="text-primary underline-offset-4 hover:underline">
                Cookie Policy
              </Link>{' '}
              for more detail.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">7. Your Rights</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Depending on where you live, you may have rights to access, correct,
              export, or delete your personal data, or to object to certain processing.
              To make a request, email us at{' '}
              <a
                href="mailto:support@getpoolcup.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                support@getpoolcup.com
              </a>
              . We will respond within a reasonable timeframe.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              8. Children&apos;s Privacy
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              PoolCup is not directed at children under 13 (or the minimum age required
              in your jurisdiction). We do not knowingly collect personal information
              from children. If you believe a child has provided us data, contact us and
              we will take steps to delete it.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">
              9. Changes to This Policy
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We may update this policy from time to time. The &quot;Last updated&quot;
              date at the top will change when we do. Continued use of PoolCup after
              changes means you accept the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-wide">10. Contact Us</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Questions about this policy? Email{' '}
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
      </div>
    </PublicPageShell>
  )
}
