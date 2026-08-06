import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import '@fontsource/bebas-neue'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { AuthenticatedChrome } from '@/components/authenticated-chrome'
import { ReportIssueProvider } from '@/components/report-issue-dialog'
import { Toaster } from '@/components/ui/sonner'
import { FriendRequestCountProvider } from '@/hooks/use-friend-request-count'
import { UnreadChatCountProvider } from '@/hooks/use-unread-chat-count'
import { AuthProvider } from '@/src/lib/auth-context'
import { DashboardTabProvider } from '@/src/lib/dashboard-tab-context'
import { MobileChatChromeProvider } from '@/src/lib/mobile-chat-chrome-context'
import { siteUrl } from '@/src/lib/site'

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
    <html lang="en" className="bg-background">
      <body
        className="font-sans antialiased bg-background text-[#f0f4f8]"
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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-green-500 focus:text-black focus:rounded"
        >
          Skip to content
        </a>
        <AuthProvider>
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
        </AuthProvider>
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
