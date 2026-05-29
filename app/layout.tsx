import type { Metadata, Viewport } from 'next'
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

export const metadata: Metadata = {
  title: 'PoolCup - World Cup 2026 Prediction Pool',
  description: 'Create a private prediction pool for your office, group chat, or Discord. Everyone predicts, the app keeps score.',
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
