'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState, type MouseEvent, type ReactNode } from 'react'
import {
  Calendar,
  ChevronRight,
  CircleHelp,
  Compass,
  FileText,
  Heart,
  Home,
  LogOut,
  Mail,
  MessageCircle,
  Settings,
  User,
  Users,
} from 'lucide-react'
import { ChatNavIconWithBadge } from '@/components/chat/chat-nav-icon-with-badge'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { NavIconWithCountBadge } from '@/components/nav-icon-with-count-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatarImage } from '@/components/user-avatar-image'
import { useFriendRequestCount } from '@/hooks/use-friend-request-count'
import { useUnreadChatCount } from '@/hooks/use-unread-chat-count'
import { cn } from '@/lib/utils'
import { usePrefetchHubRoutes } from '@/src/lib/hub-nav-prefetch'
import { useDashboardTab } from '@/src/lib/dashboard-tab-context'
import {
  CHAT_INBOX_HREF,
  DASHBOARD_TAB_HREFS,
  DISCOVER_HREF,
  FRIENDS_HREF,
  resolveHubDesktopNavValue,
  type DashboardBottomNavId,
} from '@/src/lib/mobile-bottom-nav-routes'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import { buildStripeDonateUrl } from '@/src/lib/stripe-donate-url'
import {
  HUB_DESKTOP_SIDEBAR_CLASS,
  HUB_DESKTOP_SIDEBAR_HOVER_CLASS,
  HUB_DESKTOP_SIDEBAR_WIDTH_CLASS,
} from '@/components/dashboard/hub-desktop-nav-frame'

const navItemClassName = cn(
  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
  FOCUS_VISIBLE_RING,
)

const navItemIdleClassName = cn(
  'text-muted-foreground hover:text-foreground',
  HUB_DESKTOP_SIDEBAR_HOVER_CLASS,
)

const navItemActiveClassName =
  'bg-primary/12 text-primary shadow-[inset_3px_0_0_0_var(--primary)]'

const sidebarAccordionClass =
  'grid transition-[grid-template-rows] duration-[200ms] ease-out motion-reduce:transition-none'

const sidebarGroupHeaderClassName = cn(
  'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
  navItemIdleClassName,
  FOCUS_VISIBLE_RING,
)

const nestedNavItemClassName = cn(
  navItemClassName,
  'py-2 pl-2.5 text-[13px]',
)

type HubDesktopSidebarProps = {
  userId: string
  email: string
  displayName: string
  avatar?: string | null
  customAvatarUrl?: string | null
  onOpenSettings: () => void
  signOutLoading: boolean
  onSignOut: () => void
}

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  isActive,
  prefetch,
  replace,
  onClick,
  badgeCount,
  badgeLabel,
  external,
  nested,
}: {
  href: string
  label: string
  icon: typeof Home
  isActive?: boolean
  prefetch?: boolean
  replace?: boolean
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  badgeCount?: number
  badgeLabel?: string
  external?: boolean
  nested?: boolean
}) {
  const className = cn(
    nested ? nestedNavItemClassName : navItemClassName,
    isActive ? navItemActiveClassName : navItemIdleClassName,
  )

  const content = (
    <>
      {badgeCount != null && badgeCount > 0 ? (
        <NavIconWithCountBadge
          icon={Icon}
          count={badgeCount}
          iconClassName="h-5 w-5 shrink-0"
          badgeLabel={badgeLabel ?? `${badgeCount} pending`}
        />
      ) : (
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
      )}
      <span className="truncate">{label}</span>
    </>
  )

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      replace={replace}
      aria-current={isActive ? 'page' : undefined}
      className={className}
      onClick={onClick}
    >
      {content}
    </Link>
  )
}

function SidebarNavButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  destructive,
  nested,
}: {
  label: string
  icon: typeof Home
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  nested?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        nested ? nestedNavItemClassName : navItemClassName,
        destructive
          ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50'
          : navItemIdleClassName,
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  )
}

function SidebarNavGroup({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="pt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`}
        onClick={onToggle}
        className={sidebarGroupHeaderClassName}
      >
        <span className="truncate">{label}</span>
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-[200ms] ease-out motion-reduce:transition-none',
            open && 'rotate-90',
          )}
          aria-hidden
        />
      </button>
      <div
        id={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`}
        className={sidebarAccordionClass}
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div
          className="min-h-0 overflow-hidden"
          inert={open ? undefined : true}
          aria-hidden={!open}
        >
          <div
            role="group"
            aria-label={label}
            className="ml-3 space-y-0.5 border-l border-[#292929] py-1 pl-2"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarChatLink() {
  const unreadChatCount = useUnreadChatCount()
  const pathname = usePathname() ?? ''
  const isActive = pathname === '/chat' || pathname.startsWith('/chat/')

  return (
    <Link
      href={CHAT_INBOX_HREF}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        navItemClassName,
        isActive ? navItemActiveClassName : navItemIdleClassName,
      )}
    >
      <ChatNavIconWithBadge
        icon={MessageCircle}
        count={unreadChatCount}
        iconClassName="h-5 w-5 shrink-0"
      />
      <span className="truncate">Chat</span>
    </Link>
  )
}

function SidebarUserRow({
  displayName,
  email,
  avatar,
  customAvatarUrl,
  signOutLoading,
  onSignOut,
}: {
  displayName: string
  email: string
  avatar?: string | null
  customAvatarUrl?: string | null
  signOutLoading: boolean
  onSignOut: () => void
}) {
  const label = displayName.trim() || 'Account'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
            HUB_DESKTOP_SIDEBAR_HOVER_CLASS,
            FOCUS_VISIBLE_RING,
          )}
          aria-haspopup="menu"
          aria-label={`${label} account menu`}
        >
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-muted ring-1 ring-border/80">
            <UserAvatarImage
              avatar={avatar}
              customAvatarUrl={customAvatarUrl}
              className="size-full rounded-full border-0"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{label}</p>
            {email ? (
              <p className="truncate text-[11px] text-muted-foreground">{email}</p>
            ) : null}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[12rem]"
      >
        <DropdownMenuItem
          variant="destructive"
          disabled={signOutLoading}
          onSelect={(event) => {
            event.preventDefault()
            onSignOut()
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {signOutLoading ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function HubDesktopSidebar({
  userId,
  email,
  displayName,
  avatar,
  customAvatarUrl,
  onOpenSettings,
  signOutLoading,
  onSignOut,
}: HubDesktopSidebarProps) {
  const { count: friendRequestCount } = useFriendRequestCount()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const { switchDashboardTab } = useDashboardTab()
  const isOnDashboard = pathname === '/dashboard'
  const activeNav = resolveHubDesktopNavValue(pathname, searchParams.get('tab'))
  usePrefetchHubRoutes()

    const isMoreChildActive =
    pathname === '/contact' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    (pathname === '/dashboard' && searchParams.get('tab') === 'how-it-works')

  const [accountOpen, setAccountOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(isMoreChildActive)

  function onDashboardTabClick(
    event: MouseEvent<HTMLAnchorElement>,
    navId: DashboardBottomNavId,
  ) {
    if (!isOnDashboard) return
    event.preventDefault()
    switchDashboardTab(navId)
  }

  return (
    <>
      <aside
        className={cn(HUB_DESKTOP_SIDEBAR_CLASS, HUB_DESKTOP_SIDEBAR_WIDTH_CLASS)}
        aria-label="Application"
      >
        <div className="flex h-full min-h-0 flex-col px-3 py-5">
          <div className="shrink-0 px-1 pb-6">
            <PoolCupLogo href="/dashboard" />
          </div>

          <nav
            aria-label="Main"
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
          >
            <SidebarNavLink
              href={DASHBOARD_TAB_HREFS.dashboard}
              label="Home"
              icon={Home}
              isActive={activeNav === 'dashboard'}
              prefetch
              replace={isOnDashboard}
              onClick={(event) => onDashboardTabClick(event, 'dashboard')}
            />
            <SidebarNavLink
              href={DASHBOARD_TAB_HREFS.upcoming}
              label="Matches"
              icon={Calendar}
              isActive={activeNav === 'games'}
              prefetch
              replace={isOnDashboard}
              onClick={(event) => onDashboardTabClick(event, 'upcoming')}
            />
            <SidebarNavLink
              href={FRIENDS_HREF}
              label="Friends"
              icon={Users}
              isActive={activeNav === 'friends'}
              prefetch
              badgeCount={friendRequestCount}
              badgeLabel={`${friendRequestCount} friend requests`}
            />
            <SidebarNavLink
              href={DISCOVER_HREF}
              label="Discover"
              icon={Compass}
              isActive={activeNav === 'discover'}
              prefetch
            />
            <SidebarNavLink
              href={DASHBOARD_TAB_HREFS.profile}
              label="Profile"
              icon={User}
              isActive={activeNav === 'profile'}
              prefetch
              replace={isOnDashboard}
              onClick={(event) => onDashboardTabClick(event, 'profile')}
            />

            <SidebarChatLink />

            <SidebarNavGroup
              label="Account"
              open={accountOpen}
              onToggle={() => setAccountOpen((value) => !value)}
            >
              <SidebarNavButton
                label="Settings"
                icon={Settings}
                onClick={onOpenSettings}
                nested
              />
            </SidebarNavGroup>

            <SidebarNavGroup
              label="Support & legal"
              open={moreOpen}
              onToggle={() => setMoreOpen((value) => !value)}
            >
              <SidebarNavLink
                href={DASHBOARD_TAB_HREFS['how-it-works']}
                label="Help"
                icon={CircleHelp}
                isActive={
                  pathname === '/dashboard' &&
                  searchParams.get('tab') === 'how-it-works'
                }
                prefetch
                replace={isOnDashboard}
                onClick={(event) => onDashboardTabClick(event, 'how-it-works')}
                nested
              />
              <SidebarNavLink
                href="/contact"
                label="Contact"
                icon={Mail}
                isActive={pathname === '/contact'}
                prefetch
                nested
              />
              <SidebarNavLink
                href="/terms"
                label="Terms"
                icon={FileText}
                isActive={pathname === '/terms'}
                prefetch
                nested
              />
              <SidebarNavLink
                href="/privacy"
                label="Privacy"
                icon={FileText}
                isActive={pathname === '/privacy'}
                prefetch
                nested
              />
              <SidebarNavLink
                href={buildStripeDonateUrl(userId)}
                label="Support Us"
                icon={Heart}
                external
                nested
              />
            </SidebarNavGroup>
          </nav>

          <div className="mt-auto shrink-0 border-t border-[#292929] pt-3">
            <SidebarUserRow
              displayName={displayName}
              email={email}
              avatar={avatar}
              customAvatarUrl={customAvatarUrl}
              signOutLoading={signOutLoading}
              onSignOut={onSignOut}
            />
          </div>
        </div>
      </aside>

      <div
        className={cn('hidden shrink-0 lg:block', HUB_DESKTOP_SIDEBAR_WIDTH_CLASS)}
        aria-hidden
      />
    </>
  )
}
