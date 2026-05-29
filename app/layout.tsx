import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import '@fontsource/bebas-neue'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/src/lib/auth-context'
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
  }
}

export const viewport: Viewport = {
  themeColor: '#080b0f',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-[#080b0f]">
      <body
        className="font-sans antialiased bg-[#080b0f] text-[#f0f4f8]"
        suppressHydrationWarning
      >
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
