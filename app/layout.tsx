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
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { PostHogIdentify } from '@/components/posthog-provider'
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
    verification: {
      google: 'wUcYdWnVflR1_Y88THjoEWcCYgtCrRWr-BwkzGmoBzs',
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
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className="font-sans antialiased bg-[#080b0f] text-[#f0f4f8]"
        suppressHydrationWarning
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-green-500 focus:text-black focus:rounded"
        >
          Skip to content
        </a>
        <Script id="posthog-snippet" strategy="afterInteractive">
          {`
            !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
            posthog.init('phc_tRnPRHEo6C2xZ863zDobKCqJvJD7AhM2Y7qgqBBub9MA',{api_host:'https://us.i.posthog.com',capture_pageview:true,capture_pageleave:true,disable_session_recording:false});
          `}
        </Script>
        <AuthProvider>
          <PostHogIdentify />
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
