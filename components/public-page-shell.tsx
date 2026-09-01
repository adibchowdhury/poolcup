import { LandingNavbar } from '@/components/landing/landing-navbar'
import { SiteFooter } from '@/components/site-footer'
import { cn } from '@/lib/utils'

type PublicPageShellProps = {
  children: React.ReactNode
  footerBackgroundClass?: string
  /** Page canvas behind main content. Defaults to theme background. */
  pageBackgroundClass?: string
  mainClassName?: string
}

/**
 * Shared chrome for logged-out public pages: landing navbar + footer.
 * Landing homepage keeps its own in-hero navbar and is not wrapped here.
 */
export function PublicPageShell({
  children,
  footerBackgroundClass = 'bg-[#0d1520]',
  pageBackgroundClass = 'bg-background',
  mainClassName,
}: PublicPageShellProps) {
  return (
    <div className={cn('min-h-screen', pageBackgroundClass)}>
      <header className="sticky top-0 z-50 border-b border-[rgba(255,255,255,0.08)] bg-[#0a0e12]/95 backdrop-blur-md">
        <LandingNavbar />
      </header>
      <main id="main-content" className={cn(mainClassName)}>
        {children}
      </main>
      <SiteFooter backgroundClass={footerBackgroundClass} />
    </div>
  )
}
