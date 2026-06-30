import type { Metadata, Viewport } from 'next'
import '@fontsource/bebas-neue'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'PoolCup',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
        {children}
      </body>
    </html>
  )
}
