import type { Metadata, Viewport } from 'next'
import { Inter, Space_Mono, Teko } from 'next/font/google'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { AuthenticatedChrome } from '@/components/authenticated-chrome'
import { ReportIssueProvider } from '@/components/report-issue-dialog'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { FriendRequestCountProvider } from '@/hooks/use-friend-request-count'
import { UnreadChatCountProvider } from '@/hooks/use-unread-chat-count'
import { DailyXpHeartbeat } from '@/components/xp/daily-xp-heartbeat'
import { XpFeedbackProvider } from '@/components/xp/xp-feedback-provider'
import { AuthProvider } from '@/src/lib/auth-context'
import { DashboardTabProvider } from '@/src/lib/dashboard-tab-context'
import { MobileChatChromeProvider } from '@/src/lib/mobile-chat-chrome-context'
import { siteUrl } from '@/src/lib/site'

/** UI / body — buttons, nav, labels, descriptions, settings. */
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

/** Display / brand — page titles, section headings, pool & match names. */
const teko = Teko({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-teko',
  display: 'swap',
})

/** Functional numbers — scores, timers (kept alongside Inter/Teko). */
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
})

const defaultTitle = 'PoolCup - World Cup 2026 Prediction Pool'
const defaultDescription =
  'Create a private prediction pool for your office, group chat, or Discord. Everyone predicts, the app keeps score.'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? '/'

  return {
    metadataBase: new URL(siteUrl),
    title: defaultTitle,
    description: defaultDescription,
    alternates: {
      canonical: pathname,
    },
    verification: {
      google: 'wUcYdWnVflR1_Y88THjoEWcCYgtCrRWr-BwkzGmoBzs',
    },
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#131313',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${teko.variable} ${spaceMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased bg-background text-foreground"
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  if (typeof Node === 'function' && Node.prototype) {
    var origRemove = Node.prototype.removeChild;
    Node.prototype.removeChild = function(child){
      if (child.parentNode !== this) { return child; }
      return origRemove.apply(this, arguments);
    };
    var origInsert = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(newNode, refNode){
      if (refNode && refNode.parentNode !== this) { return newNode; }
      return origInsert.apply(this, arguments);
    };
  }
})();`,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="poolcup-theme"
          disableTransitionOnChange
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-green-500 focus:text-black focus:rounded"
          >
            Skip to content
          </a>
          <AuthProvider>
            <XpFeedbackProvider>
              <DailyXpHeartbeat />
              <MobileChatChromeProvider>
                <ReportIssueProvider>
                  <Suspense fallback={null}>
                    <DashboardTabProvider>
                      <UnreadChatCountProvider>
                        <FriendRequestCountProvider>
                          {children}
                          <AuthenticatedChrome />
                        </FriendRequestCountProvider>
                      </UnreadChatCountProvider>
                    </DashboardTabProvider>
                  </Suspense>
                </ReportIssueProvider>
              </MobileChatChromeProvider>
            </XpFeedbackProvider>
          </AuthProvider>
          <Toaster richColors position="top-center" />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
